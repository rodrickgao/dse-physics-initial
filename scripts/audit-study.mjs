import fs from 'node:fs';
import vm from 'node:vm';
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('site-data.js','utf8'),ctx);
let missing=[],extras=[],conflicts=[],expected=0,matched=0;
for(const y of ctx.window.DSE_SITE_DATA.years){
 const data=JSON.parse(fs.readFileSync(`text-papers/${y.year}-${y.language}.json`));const keys=new Set();
 y.papers.slice(0,3).forEach((p,pi)=>p.questions.forEach((q,qi)=>{
  const id=q.id || Number(q.label.replace(/\D/g,'')) || qi+1;
  const key=`${y.year}|${['paper-1a','paper-1b','paper-2'][pi]}|${id}`;keys.add(key);expected++;
  if(!data[key]) {if(y.year>=2015)missing.push([y.language,key]);return;}matched++;
  const text=data[key].official.replace(/<[^>]+>/g,'').trim();const m=text.match(/(?:answer:|答案：)\s*(Deleted|[ABCD])\b/)||text.match(/^(Deleted|[ABCD])$/);
  if(q.answerText && m && q.answerText!==m[1])conflicts.push([y.language,key,q.answerText,m[1]]);
 }));
 for(const key of Object.keys(data))if(!keys.has(key))extras.push([y.language,key]);
}
console.log(JSON.stringify({expected,matched,missing,extras,conflicts},null,2));
if(missing.length||extras.length||conflicts.length)process.exitCode=1;
