import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import katex from 'katex';
import {createHash} from 'node:crypto';
import {localizeChineseExampleFigures} from './chinese-example-figures.mjs';
import {omitTextbookReferences} from './omit-textbook-references.mjs';
import {applyExampleLayoutReview} from './example-layout-review.mjs';
const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(site);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const unesc=s=>s.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
const fields=['question','answer','tips','think','thinkAnswer'];
const aligned=read(path.join(site,'scripts/example-parity-overrides.json'));
const errors=[],fallbacks=[];let formulaCount=0;
function math(tex,id){
 if(id==='ex-E102-4'&&tex==='\\frac{r_{1}^{3}}{(250 + 6370) × 10^{3} ^{3}}')tex='\\frac{r_1^3}{[(250+6370)\\times10^3]^3}';
 tex=tex.replaceAll('–','-').replaceAll('−','-').replaceAll('×','\\times ').replaceAll('⊙','\\odot ');
 tex=tex.replace(/(?<!\\)%/g,'\\%');
 try {const output=katex.renderToString(tex,{output:'mathml',throwOnError:true,strict:'ignore'});formulaCount++;return output;}
 catch(e){errors.push({id,tex,error:e.message});return '';}
}
function paragraphs(s,id){return s.split('¶').map(p=>'<p>'+p.split(/(\$[^$]+\$)/g).map(v=>v.startsWith('$')&&v.endsWith('$')?math(v.slice(1,-1),id):esc(v)).join('')+'</p>').join('');}
const think=new Map(fs.readFileSync(path.join(site,'scripts/chinese-example-think.tsv'),'utf8').trim().split(/\r?\n/).map(l=>{const [key,q,a]=l.split('|');return ['ex-'+key.replace(':','-'),{q,a}]}));
const corrections=new Map();
for(const l of fs.readFileSync(path.join(site,'scripts/chinese-example-corrections.tsv'),'utf8').trim().split(/\r?\n/)){const [key,field,value]=l.split('|');corrections.set(key+':'+field,value);}
const index=read(path.join(site,'assets/textbook-examples/index-chn.json')),enIndex=read(path.join(site,'assets/textbook-examples/index-eng.json'));
const staged=new Map(),flat=new Map();
const figures=s=>[...s.matchAll(/<p\b[^>]*>\s*<img\b[^>]*>\s*<\/p>/g)].map(m=>m[0]);
for(const book of index.books)for(const chapter of book.chapters){
 const records=read(path.join(root,`tmp/chinese-text-examples/${chapter.id}.json`));
 const english=read(path.join(site,`assets/textbook-examples/eng/${chapter.id}.json`));
 for(const [id,r] of Object.entries(records)){
  for(const f of ['question','answer','tips']){
   const englishPlain=english[id][f].replace(/<[^>]*>/g,'');
   const formulaOnly=f==='answer'&&!/[A-Za-z]{4}|[\u3400-\u9fff]/.test(englishPlain);
   if(corrections.has(id+':'+f))r[f]=paragraphs(corrections.get(id+':'+f),id)+figures(english[id][f]).join('');
   else if(formulaOnly){r[f]=english[id][f];r.source.sharedMathematicalAnswer=true;}
   else r[f]=r[f].replace(/<span data-math="([^"]*)"><\/span>/g,(_,tex)=>math(unesc(tex),id));
   if(f==='tips'){
    r[f]=r[f].replaceAll('技技巧巧分分析析','技巧分析');
    const start=r[f].search(/<p>(?:提提你|技巧分析)/);
    r[f]=start<0?'':r[f].slice(start).replace(/<p>(?:提提你|技巧分析)<\/p>$/,'');
   }
   // Always use complete master figures: equal image counts do not prove that
   // a Chinese crop contains every subfigure of an English composite image.
   if(figures(english[id][f]).length || figures(r[f]).length){r[f]=r[f].replace(/<p\b[^>]*>\s*<img\b[^>]*>\s*<\/p>/g,'')+figures(english[id][f]).join('');fallbacks.push({id,field:f});}
  }
  const t=think.get(id);r.think=t?paragraphs(t.q,id):'';r.thinkAnswer=t?paragraphs(t.a,id):'';
  for(const [field,override] of Object.entries(aligned[id]||{})){
   const digest=createHash('sha256').update(english[id][field]).digest('hex');
   if(digest!==override.sourceSha256)throw Error('Stale English-aligned translation: '+id+'/'+field);
   r[field]=override.html;
  }
  for(const field of fields)r[field]=omitTextbookReferences(r[field]);
  if(!!english[id].think!==!!t)throw Error('Think mismatch '+id);
  for(const field of fields)r[field]=localizeChineseExampleFigures(r[field]);
  r.source.textEdition='Chinese parallel text; complete source artwork with reviewed Chinese labels and English-aligned text corrections';
  r.source.thinkAnswerEdition=t?'Complete Chinese translation of the English supplementary answer':null;
  r.source.englishAlignedFields=Object.keys(aligned[id]||{});
  r.language='chn';r.format='editable-text';flat.set(id,r);
  for(const f of fields){if(/\(cid:|data-math=/.test(r[f]))errors.push({id,field:f,error:'Unresolved text encoding'});}
 }
 staged.set(chapter.id,records);
}
if(flat.size!==373||think.size!==51)throw Error('Incomplete corpus');
const audit={examples:flat.size,chapters:staged.size,thinkAnswers:think.size,formulaCount,errors,diagramFallbacks:fallbacks};
fs.writeFileSync(path.join(root,'tmp/chinese-text-examples/conversion-report.json'),JSON.stringify(audit,null,2));
if(errors.length){console.log(JSON.stringify(audit,null,2));process.exit(1);}
index.questions=enIndex.questions.map(q=>{const r=flat.get(q.id),plain=r.question.replace(/<annotation\b[\s\S]*?<\/annotation>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();return {...q,title:r.title,preview:plain.slice(0,200),searchText:plain};});
index.contentLanguage='chn';index.contentFormat='editable-text';
const output=path.join(root,'output/中文版课本例题（文本版）');fs.mkdirSync(output,{recursive:true});
fs.mkdirSync(path.join(output,'json'),{recursive:true});
const css='body{max-width:900px;margin:40px auto;padding:0 20px;font:18px/1.8 system-ui,sans-serif;color:#182a36}p{margin:12px 0}img{max-width:100%;height:auto}table{border-collapse:collapse}td{border:1px solid #ccd6df;padding:6px 12px}article{border-top:1px solid #ccd6df;padding-top:24px;margin-top:40px}math{font-size:1.1em}.katex{display:inline-block;max-width:100%;overflow-x:auto;vertical-align:middle;padding-block:.2em}.study-table-wrap{overflow:auto}h3{color:#197c76}';
function offline(s){return s.replace(/src="(assets\/[^\"]+)"/g,(_,p)=>{const file=path.join(site,p);if(!fs.existsSync(file))throw Error(p);return `src="data:image/${p.endsWith('.jpg')?'jpeg':'png'};base64,${fs.readFileSync(file).toString('base64')}"`;});}
const links=[];
for(const [code,records] of staged){
 fs.writeFileSync(path.join(site,`assets/textbook-examples/chn/${code}.json`),JSON.stringify(records));
 fs.writeFileSync(path.join(output,'json',code+'.json'),JSON.stringify(records,null,2));
 for(const r of Object.values(records))for(const field of fields)for(const [,src] of r[field].matchAll(/src="(assets\/[^\"]+)"/g)){
  const destination=path.join(output,'json',src);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.copyFileSync(path.join(site,src),destination);
 }
 const articles=Object.values(records).map(r=>`<article id="${r.id}"><h2>例題 ${r.number} · ${esc(r.title)}</h2><h3>題目</h3>${r.question}<h3>課本解答</h3>${r.answer}${r.tips?'<h3>提示</h3>'+r.tips:''}${r.think?'<h3>Think about · 想一想</h3>'+r.think+'<h3>思考題解答</h3>'+r.thinkAnswer:''}</article>`).join('');
 fs.writeFileSync(path.join(output,code+'.html'),`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${code} 中文例題</title><style>${css}</style><body><a href="index.html">返回目錄</a><h1>${code} 中文課本例題</h1>${offline(articles)}</body></html>`);
 links.push(`<p><a href="${code}.html">${code} · ${Object.keys(records).length} 道例題</a></p>`);
}
fs.writeFileSync(path.join(site,'assets/textbook-examples/index-chn.json'),JSON.stringify(index));
fs.writeFileSync(path.join(output,'index.html'),`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>中文課本例題（文本版）</title><style>${css}</style><h1>中文課本例題（文本版）</h1><p>46 章 · 373 道例題 · 51 組思考題及解答</p>${links.join('')}</html>`);
fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(audit,null,2));
applyExampleLayoutReview('chn');
console.log(JSON.stringify({examples:373,chapters:46,thinkAnswers:51,formulaCount,diagramFallbacks:fallbacks.length,output}));
