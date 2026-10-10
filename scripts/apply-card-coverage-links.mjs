import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const site=new URL('../',import.meta.url);
const coverage=JSON.parse(fs.readFileSync(new URL('card-coverage-review.json',import.meta.url),'utf8'));
const ctx={window:{}};
for(const file of ['textbook-data.js','knowledge-network-data.js','paper2-knowledge-data.js','statistics-data.js'])vm.runInNewContext(fs.readFileSync(new URL(file,site),'utf8'),ctx);
const d=ctx.window.DSE_TEXTBOOK_DATA,network={...ctx.window.DSE_KNOWLEDGE_NETWORK,...ctx.window.DSE_PAPER2_KNOWLEDGE},stats=ctx.window.DSE_STATISTICS;
let added=0;
for(const [key,links]of Object.entries(coverage.questionLinks||{})){
 if(key.startsWith('tb-')){
  for(const language of ['chn','eng']){
   const file=new URL(`assets/textbook-exercises/index-${language}.json`,site),index=JSON.parse(fs.readFileSync(file,'utf8'));
   const question=index.questions.find(q=>q.id===key);assert.ok(question,key);
   for(const link of links)if(!question.knowledge.includes(link.sequence)){question.knowledge.push(link.sequence);added++;}
   const text=JSON.stringify(index);if(JSON.stringify(JSON.parse(fs.readFileSync(file,'utf8')))!==text)fs.writeFileSync(file,text+'\n');
  }
  continue;
 }
 const n=network[key];assert.ok(n,key);n.links??=[];n.chapters??=[];
 for(const {sequence,evidence}of links){
  const p=d.languages.eng.find(p=>p.sequence===sequence),z=d.languages.chn.find(p=>p.sequence===sequence);assert.ok(p&&!p.is_governing_law,key);
  if(key.includes('|paper-2|'))assert.equal(p.book_key,'elective-'+key.split('|')[2].split('.')[0]);
  if(n.links.some(l=>l.sequence===sequence))continue;
  n.links.push({sequence,code:p.code,chapterEn:p.chapter,chapterZh:z.chapter,bookKey:p.book_key,category:p.category,categoryCode:p.category_code,type:n.links.length?'supporting':'primary',evidence,reviewVersion:'2026-10-10-coverage',sourceRefs:(p.source_excerpts||[]).map(s=>({source:s.source,code:s.code,page:s.page}))});
  n.chapters=[...new Set([...n.chapters,p.code])];n.keywords=(n.keywords||'')+' '+p.card_title+' '+z.card_title;added++;
 }
}
const keys=Object.keys(network),ps=d.languages.eng.map(p=>{
 const z=d.languages.chn.find(q=>q.sequence===p.sequence),questions=keys.filter(k=>network[k].links.some(l=>l.sequence===p.sequence)),years=[...new Set(questions.map(k=>Number(k.split('|')[0])))].sort();
 return{sequence:p.sequence,code:p.code,bookEn:p.book,bookZh:z.book,chapterEn:p.chapter,chapterZh:z.chapter,textEn:p.content,textZh:z.content,bookKey:p.book_key,category:p.category,categoryCode:p.category_code,categoryEn:p.category_en,importance:null,linkPolicy:p.is_governing_law?'standalone':p.link_policy,frequency:questions.length,firstYear:years[0]??null,latestYear:years.at(-1)??null,years,questions};
});stats.points=ps;
const count=points=>{const linkable=points.filter(p=>p.linkPolicy!=='standalone'),covered=linkable.filter(p=>p.frequency);return{pointCount:points.length,linkablePointCount:linkable.length,standaloneLawCount:points.length-linkable.length,coveredPoints:covered.length,coverageRate:covered.length/linkable.length};};
for(const c of stats.chapters)Object.assign(c,count(ps.filter(p=>p.code===c.code)),{questionCount:keys.filter(k=>network[k].chapters.includes(c.code)).length});
for(const b of stats.books)Object.assign(b,count(ps.filter(p=>p.bookEn===b.bookEn)));
const total=count(ps);Object.assign(stats.summary,{knowledgeLinks:keys.reduce((n,k)=>n+network[k].links.length,0),knowledgePointCount:total.pointCount,linkableKnowledgePointCount:total.linkablePointCount,standaloneGoverningLawCount:total.standaloneLawCount,coveredPoints:total.coveredPoints,uncoveredPoints:total.linkablePointCount-total.coveredPoints,coverageRate:total.coverageRate,multiPointQuestions:keys.filter(k=>network[k].links.length>1).length,multiChapterQuestions:keys.filter(k=>network[k].chapters.length>1).length});
stats.frequencyBands=[['0',0,0],['1–2',1,2],['3–5',3,5],['6–10',6,10],['11+',11,Infinity]].map(([label,min,max])=>({label,count:ps.filter(p=>p.frequency>=min&&p.frequency<=max).length}));
for(const y of stats.years)y.coveredPoints=new Set(keys.filter(k=>k.startsWith(y.year+'|')).flatMap(k=>network[k].links.map(l=>l.sequence))).size;
stats.methodology.mappingVersion='canonical-sqlite-v2 + textbook-evidence-20261010';
const write=(file,name,value)=>{const output=`window.${name} = ${JSON.stringify(value)};\n`;if(fs.readFileSync(new URL(file,site),'utf8')!==output)fs.writeFileSync(new URL(file,site),output);};
write('knowledge-network-data.js','DSE_KNOWLEDGE_NETWORK',network);
write('paper2-knowledge-data.js','DSE_PAPER2_KNOWLEDGE',Object.fromEntries(Object.entries(network).filter(([k])=>k.includes('|paper-2|'))));
write('statistics-data.js','DSE_STATISTICS',stats);
console.log(JSON.stringify({coverageQuestionLinks:Object.keys(coverage.questionLinks||{}).length,added,knowledgePoints:ps.length}));
