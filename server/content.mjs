import { MEMBERSHIP_ENABLED } from '../src/lib/access-policy.js';
import { compareMistakePrintEntries } from '../src/lib/study-content.js';
import { numberKnowledgePoints } from '../src/lib/knowledge-numbering.js';
import { readFileSync, readdirSync, createReadStream, statSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { runInNewContext } from 'node:vm';
import { root, questions, points } from './catalog.mjs';
import { createContentLimiter } from './content-limits.mjs';
import { indexQuestion, rankQuestionEntries } from './search-engine.mjs';
import { analyzeMistakes } from './learning-analysis.mjs';


const read = name => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const context = {window:{}};
for (const name of ['site-data','statistics-data','textbook-data']) runInNewContext(readFileSync(resolve(root, `${name}.js`),'utf8'),context);
export const navigation = structuredClone(context.window.DSE_SITE_DATA);
// Directory identities are not question content. Answers and original source metadata never bootstrap.
for (const year of navigation.years) for (const paper of year.papers) for (const q of paper.questions) {
  for (const field of Object.keys(q)) if (!['id','label','section','knowledgeQuestion'].includes(field)) delete q[field];
}
export const publicStatistics = structuredClone(context.window.DSE_STATISTICS);
delete publicStatistics.methodology;
for (const point of publicStatistics.points || []) { delete point.questions; delete point.linkPolicy; delete point.importance; }
export const publicTextbook = structuredClone(context.window.DSE_TEXTBOOK_DATA);
delete publicTextbook.review;
for (const list of Object.values(publicTextbook.languages)) for(const point of list) {
  for(const field of ['link_policy','card_review','review_version','importance','box']) delete point[field];
}
const fail = (status, message) => { throw Object.assign(new Error(message),{status}); };
const text = value => String(value || '').replace(/<annotation[\s\S]*?<\/annotation>/g,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const pick = (object, keys) => Object.fromEntries(keys.filter(k => object[k] !== undefined).map(k=>[k,object[k]]));

export function createContent({ db, clock, membership, membershipEnabled = MEMBERSHIP_ENABLED, limiterConfig, qdnaDirectory }) {
  const limit = createContentLimiter({db,clock,config:limiterConfig});
  db.exec('CREATE TABLE IF NOT EXISTS protected_content(language TEXT, id TEXT, source TEXT, body TEXT, PRIMARY KEY(language,id))');
  db.exec('CREATE TABLE IF NOT EXISTS protected_dna(language TEXT, id TEXT, body TEXT, PRIMARY KEY(language,id))');
  if (qdnaDirectory) {
    const put = db.prepare('INSERT OR REPLACE INTO protected_dna VALUES(?,?,?)');
    db.exec('BEGIN');
    try {
      for (const [lang,label] of [['chn','中文版'],['eng','英文版']]) {
        const file=resolve(qdnaDirectory,label,'json/QDNA.json');
        if(!existsSync(file))throw new Error('Configured private DNA source is missing');
        const rows=JSON.parse(readFileSync(file,'utf8'));
        if(!Array.isArray(rows))throw new Error('Invalid private DNA source');
        db.prepare('DELETE FROM protected_dna WHERE language=?').run(lang);
        for(const row of rows) {if(typeof row.question_id!=='string')throw new Error('Invalid private DNA identity');put.run(lang,row.question_id,JSON.stringify(row));}
      }
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  const insert = db.prepare('INSERT OR REPLACE INTO protected_content VALUES(?,?,?,?)');
  const records = new Map(), directories = {}, indexes = {}, files = new Map();
  const registerHtml = (html, paid=false) => {
    for (const m of String(html || '').matchAll(/(?:src|href)=["']\/?((?:assets|text-papers)\/[^"'?#]+)["']/g)) {
      const path = '/'+m[1]; files.set(path, (files.get(path) ?? true) && paid);
    }
  };
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM protected_content');
    for (const lang of ['chn','eng']) {
      const rows = new Map(); records.set(lang, rows);
      for (const file of readdirSync(resolve(root,'text-papers')).filter(f=>f.endsWith(`-${lang}.json`))) {
        for (const [id, body] of Object.entries(read(`text-papers/${file}`))) rows.set(id,{source:'past-paper',body});
      }
      for (const [folder,source] of [['textbook-exercises','textbook'],['textbook-examples','examples']]) {
        const index = read(`assets/${folder}/index-${lang}.json`);
        directories[`${source}:${lang}`] = { version:index.version, books:index.books.map(b=>({...pick(b,['id','title','count']),chapters:b.chapters.map(c=>({...pick(c,['id','title','count']),firstId:index.questions.find(q=>q.chapter===c.id)?.id,sections:[]}))})),
          questions:index.questions.map(q=>({...pick(q,['id','chapter','number','kind','title']),knowledge:[]})) };
        for (const chapter of index.books.flatMap(b=>b.chapters)) for (const [id,body] of Object.entries(read(`assets/${folder}/${lang}/${chapter.id}.json`))) rows.set(id,{source,body});
      }
      for (const [id, {source,body}] of rows) {
        insert.run(lang,id,source,JSON.stringify(body));
        for (const field of ['question','answer','official','officialScreenshot','officialOriginal','tips','think','thinkAnswer']) registerHtml(body[field]);
        registerHtml(body.reasoning,true);
      }
      indexes[lang] = [...rows].map(([key,{source,body}],i)=> {
        const q = questions.get(key), sequences = q?.points || [];
        const entry = {key,source,label: lang==='eng' ? q?.labelEn || q?.label : q?.label, chapter:body.chapter || q?.primaryChapterCode || '',year:{year:Number(key.split('|')[0])||0},paper:{title:key.split('|')[1]||source},question:{label:body.number||key.split('|')[2],kind:body.kind},yearIndex:0,paperIndex:0,questionIndex:i,searchKnowledge:sequences.map(s=>points.get(s)?.card_title||'').join(' ')};
        return indexQuestion(entry,text(body.question));
      });
      for(const point of context.window.DSE_TEXTBOOK_DATA.languages[lang]) indexes[lang].push(indexQuestion({key:`knowledge-${point.sequence}`,sequence:point.sequence,source:'knowledge',label:`${point.number || point.sequence} · ${point.card_title || point.chapter}`,chapter:point.chapter,year:{year:0},paper:{title:'Knowledge'},question:{label:point.card_title},yearIndex:1001,questionIndex:point.sequence},point.card_summary||point.content));
    }
    db.exec('COMMIT');
  } catch(error) { db.exec('ROLLBACK'); throw error; }
  // Scan fallbacks and reports are public under the pre-existing trial policy.
  for (const year of context.window.DSE_SITE_DATA.years) for (const paper of year.papers) for (const q of paper.questions) for (const field of ['question','answer']) for (const file of q[field]||[]) files.set(`/assets/${year.id}/${file}`,false);
  for (const file of read('downloads/catalog.json').files) if (file.kind==='paper' && file.edition==='original') files.set('/'+file.url,false);
  if (!membershipEnabled) for (const lang of ['chn','eng']) for (const code of new Set([...points.values()].map(p=>p.code))) files.set(`/assets/textbook/pdfs/${lang}/${code}.pdf`,true);
  const premium = user => !!user && (!membershipEnabled||user.role==='admin'||membership(user.id).active);
  const requirePremium = user => {if (!user) fail(401,'请先登录。'); if (!premium(user)) fail(403,'此内容需要有效会员。');};
  const displayLinks = ids => ids.map(sequence=>({sequence,chapterZh:points.get(sequence)?.chapter,chapterEn:points.get(sequence)?.chapter}));
  const trialChapters=new Set([...points.values()].filter(p=>p.book_key==='compulsory-1').map(p=>p.code));
  const trialPoint = id => points.get(Number(id))?.book_key === 'compulsory-1';
  const links = (key,user) => {
    const q=questions.get(key), visible=ids=>(ids||[]).filter(id=>premium(user)||trialPoint(id));
    return {links:displayLinks(visible(q?.points)),relatedLinks:displayLinks(visible(q?.relatedPoints))};
  };
  const trialQuestion = id => {
    const q=questions.get(id);
    return [...(q?.points||[]),...(q?.relatedPoints||[])].some(trialPoint)||(/^(?:ex|tb)-/.test(id||'')&&trialChapters.has(id.split('-')[1]));
  };
  function validate(url, allowed) {
    for (const key of url.searchParams.keys()) if (!allowed.includes(key) || url.searchParams.getAll(key).length!==1) fail(400,'不支持此请求参数。');
  }
  function integer(url,key,fallback,max) { const value=url.searchParams.get(key); if(value===null)return fallback; if(!/^\d+$/.test(value)||Number(value)>max)fail(400,'分页参数超出范围。');return Number(value); }
  const publicRow = row => pick(row,['key','source','label','chapter','excerpt','matchLabels','matchLabelsEn','sequence']);
  const select = db.prepare('SELECT source,body FROM protected_content WHERE language=? AND id=?');
  function detail(id,lang,user) {
    const row=select.get(lang,id);if(!row)fail(404,'找不到题目。'); const body=JSON.parse(row.body);
    const result={...pick(body,['kind','id','number','title','chapter','question','answer','official','officialFormat','officialScreenshot','officialOriginal','tips','think','thinkAnswer']),id,hasReasoning:!!body.reasoning,premiumLocked:!premium(user)};
    if(premium(user))result.reasoning=body.reasoning||'';
    result.linksAvailable=premium(user)||trialQuestion(id);
    if(result.linksAvailable){result.network=links(id,user);result.knowledge=result.network.links.map(l=>l.sequence);}
    result.kind=questions.get(id)?.kind || body.kind;
    return result;
  }
  let learning;
  return {
    setLearning(value){learning=value;},
    adminDna(url) {
      validate(url,['id','language']);
      const row=db.prepare('SELECT body FROM protected_dna WHERE language=? AND id=?').get(url.searchParams.get('language')||'chn',url.searchParams.get('id'));
      if(!row)fail(404,'找不到此标注。');return JSON.parse(row.body);
    },
    handle(req,res,url,user) {
      if(!url.pathname.startsWith('/api/content/'))return false;
      if(req.method!=='GET')fail(405,'只支持 GET。');
      const route=url.pathname.slice('/api/content/'.length), lang=url.searchParams.get('language')||'chn';
      if(!['chn','eng'].includes(lang))fail(400,'无效语言。');
      res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');
      const send=data=>{res.end(JSON.stringify(data));return true;};
      if(route==='report') {
        validate(url,['language','year','page']);limit(req,res,user,'detail');
        const year=integer(url,'year',0,2100),page=integer(url,'page',0,1000);
        const source=context.window.DSE_SITE_DATA.years.find(y=>Number(y.year)===year&&y.language===lang);
        const q=source?.papers[3]?.questions[page];if(!q)fail(404,'找不到报告页。');
        return send({images:(q.question||[]).map(p=>`assets/${source.id}/${p}`)});
      }
      if(route==='question') {validate(url,['language','id']);limit(req,res,user,'detail');return send(detail(url.searchParams.get('id'),lang,user));}
      if(route==='directory') {
        validate(url,['language','source','id','chapter','offset','limit']);limit(req,res,user,'directory');
        const value=directories[`${url.searchParams.get('source')}:${lang}`];if(!value)fail(400,'无效目录。');
        const chapter=url.searchParams.get('chapter')||value.questions.find(q=>q.id===url.searchParams.get('id'))?.chapter;
        const size=integer(url,'limit',50,50),offset=integer(url,'offset',0,10000);if(size<1)fail(400,'无效分页。');
        const selected=value.questions.filter(q=>q.chapter===chapter);
        return send({...value,questions:selected.slice(offset,offset+size),hasMore:offset+size<selected.length});
      }
      if(route==='search') {
        validate(url,['language','q','source','offset','limit']);limit(req,res,user,'search');
        const query=url.searchParams.get('q')||'';if(query.length>200)fail(400,'搜索内容过长。');
        const size=integer(url,'limit',30,50), offset=integer(url,'offset',0,10000);if(size<1)fail(400,'无效分页。');
        const source=url.searchParams.get('source')||'all';if(!['all','past-paper','textbook','examples','knowledge'].includes(source))fail(400,'无效题目类型。');
        const ranked=query.trim()?rankQuestionEntries(indexes[lang].filter(r=>source==='all'||r.entry.source===source),query):[];
        return send({results:ranked.slice(offset,offset+size).map(publicRow),total:ranked.length,hasMore:offset+size<ranked.length});
      }
      if(route==='links') {
        validate(url,['language','id']);const id=url.searchParams.get('id');if(!trialQuestion(id))requirePremium(user);limit(req,res,user,'links');if(!questions.has(id))fail(404,'找不到题目。');return send({...links(id,user),linksAvailable:true});
      }
      if(route==='related') {
        validate(url,['language','points','offset','limit']);limit(req,res,user,'links');
        const ids=(url.searchParams.get('points')||'').split(',');if(ids.length>12||ids.some(id=>!/^\d+$/.test(id)||!points.has(Number(id))))fail(400,'知识点参数不正确。');
        const size=integer(url,'limit',30,50), offset=integer(url,'offset',0,10000);if(size<1)fail(400,'无效分页。');
        if(!ids.every(id=>trialPoint(Number(id))))requirePremium(user);
        const wanted=new Set(ids.map(Number));const rows=[...questions.values()].filter(q=>q.points.some(p=>wanted.has(p))||(q.relatedPoints||[]).some(p=>wanted.has(p)));
        return send({results:rows.slice(offset,offset+size).map(q=>({key:q.key,id:q.key,source:q.source||'past-paper',relationship:q.points.some(p=>wanted.has(p))?'direct':'background',chapter:q.key.split('-').slice(1,-1).join('-'),number:q.key.split('-').at(-1)})),hasMore:offset+size<rows.length});
      }
      if(route==='mistake-summary') {
        validate(url,['language','point']);if(!user)fail(401,'请先登录。');limit(req,res,user,'links');
        const saved=db.prepare('SELECT question_key, marked_at FROM mistakes WHERE user_id=?').all(user.id);
        const owned=saved.map(r=>questions.get(r.question_key)).filter(Boolean);
        const entries=owned.map(q=>({key:q.key,source:q.source,exerciseChapter:q.exerciseChapter,network:premium(user)?links(q.key,user):{links:[]},primaryChapterCode:q.primaryChapterCode,sortChapter:q.chapterCode,paperIndex:q.key.includes('paper-1a')?0:1,question:{kind:q.kind}}));
        const summary=analyzeMistakes(entries,numberKnowledgePoints(context.window.DSE_TEXTBOOK_DATA.languages[lang]),lang);
        summary.recommendations=learning.snapshot(user.id,lang).signals.rows.filter(r=>r.status==='NEEDS_REVIEW').slice(0,3).map(r=>({sequence:Number(r.knowledge_id),count:r.wrong_question_count}));
        if(url.searchParams.has('point')){requirePremium(user);const point=integer(url,'point',0,1000);summary.filterKeys=owned.filter(q=>q.points.includes(point)).map(q=>q.key);}
        // Return only this user's ordered identities; keep knowledge mappings on the server.
        const marked = new Map(saved.map(r=>[r.question_key,r.marked_at]));
        summary.orderedKeys=entries.map(entry=>({...entry,markedAt:new Date(marked.get(entry.key)).toISOString(),network:{links:questions.get(entry.key).points.map(sequence=>({sequence}))}}))
          .sort(compareMistakePrintEntries(numberKnowledgePoints(context.window.DSE_TEXTBOOK_DATA.languages[lang]))).map(entry=>entry.key);
        summary.questionKinds=Object.fromEntries(owned.map(q=>[q.key,q.kind]));
        return send(summary);
      }
      if(route==='recommendations') {
        validate(url,['language','batch']);if(!user)fail(401,'请先登录。');limit(req,res,user,'similar');const batch=integer(url,'batch',0,10000);
        return send(learning.snapshot(user.id,lang,8,{trialOnly:!premium(user)}).recommendations);
      }
      fail(404,'找不到此操作。');
    },
    file(req,res,user) {
      let path;try{path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replaceAll('\\','/');}catch{res.writeHead(400);res.end();return true;}
      if (path.includes('%') || path.includes('\0') || (/^\/@fs\//i.test(path) && !path.includes('/node_modules/'))) {res.writeHead(404);res.end('Not found');return true;}
      const deny=()=>{res.writeHead(404,{'Cache-Control':'no-store'});res.end('Not found');return true;};
      if(/(?:^|\/)(?:\.[^/]+|private|dist|server|scripts|tests|output|deployment|src\/lib\/(?:textbook-example-knowledge|question-search\.js|search-concepts|profile-review|mistake-analysis))|\.(?:sqlite(?:-wal|-shm)?|db|pem|key|map)$|(?:QDNA|knowledge_catalog)/i.test(path))return deny();
      const bootstrap={'/site-data.js':`window.DSE_SITE_DATA=${JSON.stringify(navigation)};`,'/textbook-data.js':`window.DSE_TEXTBOOK_DATA=${JSON.stringify(publicTextbook)};`,'/statistics-data.js':`window.DSE_STATISTICS=${JSON.stringify(publicStatistics)};`,'/knowledge-network-data.js':'window.DSE_KNOWLEDGE_NETWORK={};','/paper2-knowledge-data.js':'window.DSE_PAPER2_KNOWLEDGE={};'};
      if(bootstrap[path]){res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(bootstrap[path]);return true;}
      const protectedPath=/^\/(?:text-papers|downloads|assets\/(?:textbook-exercises|textbook-examples|20\d{2}[^/]*|textbook\/pdfs))(?:\/|$)/i.test(path);
      if(!protectedPath)return false;
      if(!files.has(path))return deny();
      try {
        if(files.get(path))requirePremium(user);
        if(!['GET','HEAD'].includes(req.method))fail(405,'Method not allowed');
        limit(req,res,user,extname(path)==='.pdf'?'download':'image');
        const file=resolve(root,'.'+path), stat=statSync(file);
        const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.pdf':'application/pdf'};
        res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'});
        if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);return true;
      }catch(error){res.writeHead(error.status||404,{'Cache-Control':'no-store'});res.end(error.status?error.message:'Not found');return true;}
    }
  };
}
