import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {printableQuestion,printDocumentHtml,compareMistakePrintEntries,escapeHtml} from '../src/lib/study-content.js';
const entry={key:'2024|paper-1a|1',year:{year:2024,id:'2024-eng'},paperIndex:0,question:{label:'Q1',question:['p1a/q01.jpg'],answerText:'B'}};
const content={question:'<p>mass / kg <sup>2</sup></p>',official:'<p>OFFICIAL B</p>',officialScreenshot:'<p><img src="OFFICIAL.png" alt="Official answer"/></p>',reasoning:'<p>REASONING</p>'};
test('choice practice leaves the answer margin blank and preserves question content',()=>{
 const html=printableQuestion(entry,content,{language:'eng',mode:'questions',spaceMm:80});
 assert.match(html,/print-choice/);assert.doesNotMatch(html,/answer-line|answer-blank|working-space|OFFICIAL|REASONING/);assert.match(html,/<sup>2<\/sup>/);
 assert.doesNotMatch(printableQuestion(entry,content,{language:'chn',mode:'questions'}),/答案|answer-line|answer-blank/);
 const structured={...entry,paperIndex:1};
 assert.match(printableQuestion(structured,content,{language:'chn',mode:'questions'}),/class="working-space"><\/div>/);
 const electiveChoice={...entry,paperIndex:2,question:{...entry.question,kind:'multiple-choice'}};
 assert.match(printableQuestion(electiveChoice,content,{language:'eng',mode:'questions'}),/print-choice/);
 assert.doesNotMatch(printableQuestion(electiveChoice,content,{language:'eng',mode:'questions'}),/working-space|answer-line/);
});
test('worked export preserves all three ordered stages without writing space',()=>{
 const html=printableQuestion(entry,content,{language:'chn',mode:'detailed'});
 assert.ok(html.indexOf('mass')<html.indexOf('OFFICIAL'));assert.ok(html.indexOf('OFFICIAL')<html.indexOf('REASONING'));
 assert.doesNotMatch(html,/working-space/);
 assert.match(html,/<img src="OFFICIAL.png"/);assert.doesNotMatch(html,/<p>OFFICIAL B/);
});
test('missing transcription remains an explicitly labelled original scan',()=>{
 const html=printableQuestion(entry,null,{language:'chn',mode:'detailed'});
 assert.match(html,/assets\/2024-eng\/p1a\/q01.jpg/);assert.match(html,/尚待核验/);
});
test('print format matches bilingual Word typography and colours',()=>{
 const html=printDocumentHtml([entry],[content],{language:'chn',mode:'detailed',baseUrl:'https://example.org/papers/'});
 for(const value of ['Times New Roman','SimSun','color:#f00','color:#0000ff','size:A4','break-before:page','border:0'])assert.ok(html.includes(value),value);
 assert.equal(escapeHtml('<script>"&'),'&lt;script&gt;&quot;&amp;');
});
test('published study blocks contain only local assets and no active content',()=>{
 for(const file of fs.readdirSync('text-papers').filter(x=>/^20\d\d-(eng|chn)\.json$/.test(x))){
  const data=JSON.parse(fs.readFileSync(`text-papers/${file}`));
  for(const [key,r] of Object.entries(data)){
   const html=[r.question,r.official,r.reasoning,r.officialScreenshot].join('');
   assert.match(r.officialScreenshot,/<img /,`${file} ${key} screenshot`);
   assert.equal(r.officialScreenshot.replace(/<[^>]*>/g,'').trim(),'');
   assert.doesNotMatch(html,/<script|\bon\w+\s*=|javascript:|file:\/\/|C:\\/i,`${file} ${key}`);
   for(const [,src]of html.matchAll(/<img[^>]+src="([^"]+)"/g))assert.ok(fs.existsSync(src),src);
   for(const field of ['question','official','reasoning'])assert.ok(r[field],`${file} ${key} ${field}`);
  }
 }
});
test('current release has complete 2012-2025 question and reasoning coverage',()=>{
 const release=JSON.parse(fs.readFileSync('text-papers/release.json'));
 assert.equal(release.questions,1116);assert.equal(release.editions,2232);
 assert.equal(release.pendingSolutions+release.detailedSolutions,release.editions);
 assert.equal(release.pendingSolutions,0);assert.equal(release.nativeQuestions,2232);
 for(const lang of ['eng','chn']){
  const data=JSON.parse(fs.readFileSync(`text-papers/2025-${lang}.json`));
  assert.equal(Object.keys(data).length,81);
  for(const r of Object.values(data)){
   for(const f of ['question','official','reasoning'])assert.ok(r[f]);
   if(lang==='chn')assert.match(r.sourceNote,/並非考評局官方中文原卷/);
  }
 }
 const en=JSON.parse(fs.readFileSync('text-papers/2025-eng.json'));
 assert.match(en['2025|paper-1a|7'].reasoning,/No 45° rod angle/);
 assert.doesNotMatch(en['2025|paper-1a|7'].reasoning,/F\s*=\s*W\s*\/\s*2/);
 assert.match(en['2025|paper-1b|7'].reasoning,/source internal resistance is negligible/);
 assert.match(en['2025|paper-2|1.1'].reasoning,/westward/i);
 for(const [year,key] of [[2016,'paper-1a|29'],[2017,'paper-2|3.7'],[2018,'paper-1a|1']]){
  for(const lang of ['eng','chn'])assert.match(JSON.parse(fs.readFileSync(`text-papers/${year}-${lang}.json`))[`${year}|${key}`].official,/Deleted|刪題|已刪去/);
 }
});
test('all 2012 Paper 1A questions have reviewed bilingual text and reasoning',()=>{
 for(const lang of ['eng','chn']){
  const data=JSON.parse(fs.readFileSync(`text-papers/2012-${lang}.json`));
  for(let n=1;n<=36;n++){
   const r=data[`2012|paper-1a|${n}`];
   for(const field of ['question','official','reasoning'])assert.ok(r?.[field],`${lang} Q${n} ${field}`);
   assert.doesNotMatch(r.reasoning,/pending|尚待核驗/i);
  }
 }
});
test('practice print omits explanatory labels and keeps the answer margin blank',()=>{
 const html=printableQuestion(entry,{...content,sourceNote:'中文研習版，並非考評局官方中文原卷。'},{language:'chn',mode:'questions'});
 assert.doesNotMatch(html,/並非考評局官方中文原卷|OFFICIAL|REASONING|study-source-note|<h3>|作答区/);
 assert.match(html,/print-choice/);assert.doesNotMatch(html,/答案|answer-line|answer-blank/);
});

test('print groups choice questions including Paper 2, then sorts by chapter with content paired',()=>{
 const make=(key,paperIndex,kind,sequences)=>({...entry,key,paperIndex,question:{...entry.question,kind},network:{links:sequences.map(sequence=>({sequence}))}});
 const entries=[make('structured',1,'structured',[2]),make('later-mc',0,undefined,[1]),make('paper2-mc',2,'multiple-choice',[1,2]),make('unmapped',0,undefined,[])];
 const points=[{sequence:2,code:'101'},{sequence:1,code:'201'}];
 entries[2].network.links[1].type='primary';
 const ordered=[...entries].sort(compareMistakePrintEntries(points));
 assert.deepEqual(ordered.map(e=>e.key),['paper2-mc','later-mc','unmapped','structured']);
 const html=printDocumentHtml(entries,entries.map(e=>({question:`<p>CONTENT-${e.key}</p>`})),{language:'chn',mode:'questions',baseUrl:'http://localhost/',knowledgePoints:points,date:new Date(2026,8,28)});
 assert.match(html,/<h1>2026年9月28日错题<\/h1>/);
 assert.doesNotMatch(html,/print-intro|本册只含|关闭浏览器|作答区/);
 assert.match(html,/@page \{size:A4;margin:0\}/);
 assert.match(html,/border:1pt solid #555/);
 assert.deepEqual([...html.matchAll(/data-question="([^"]+)"/g)].map(m=>m[1]),ordered.map(e=>e.key));
 for(const article of html.matchAll(/<article[^>]+data-question="([^"]+)"[\s\S]*?<\/article>/g)) assert.ok(article[0].includes(`CONTENT-${article[1]}`));
 assert.equal(entries[0].key,'structured');
});


test('both export languages and modes use a printable image watermark, including continued pages',()=>{
 for(const language of ['chn','eng']) for(const mode of ['questions','detailed']) {
  const html=printDocumentHtml([entry],[content],{language,mode,baseUrl:'http://localhost/'});
  assert.ok(html.includes(`class="print-watermark" src="assets/brand/signature-${language}.png"`));
  assert.match(html,/\.print-watermark\{position:fixed/);
  assert.ok(html.includes("top:148.5mm;left:105mm;width:190mm"));
  assert.ok(html.includes("translate(-50%,-50%) rotate(-35deg)"));
  assert.doesNotMatch(html,/background:url\("assets\/brand/);
 }
});
