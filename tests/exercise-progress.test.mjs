import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../server/api.mjs';
import { questions } from '../server/catalog.mjs';
import { compareMistakePrintEntries, printableQuestion, printDocumentHtml } from '../src/lib/study-content.js';
import { exerciseMistakeEntries } from '../src/lib/textbook-exercises.js';

test('mixed mistakes sort by type, chapter, then collection time, with identical print order',()=>{
 const points=[{sequence:50,code:'101'},{sequence:2,code:'101'},{sequence:1,code:'201'}];
 const make=(key,seq,date,kind='multiple-choice')=>({key,paperIndex:kind==='multiple-choice'?0:1,year:{year:2012,id:'2012-chn'},question:{label:key,kind},network:{links:[{sequence:seq}]},markedAt:date});
 const entries=[make('late-first-point',50,'2026-09-20'),make('early-second-point',2,'2026-09-01'),make('structured',50,'2026-08-01','structured'),make('later-chapter',1,'2026-07-01')];
 const order=['early-second-point','late-first-point','later-chapter','structured'];
 assert.deepEqual([...entries].sort(compareMistakePrintEntries(points)).map(e=>e.key),order);
 const privateLinksRemoved=entries.map(e=>({...e,mistakeOrder:order.indexOf(e.key),network:{links:[]}}));
 assert.deepEqual(privateLinksRemoved.sort(compareMistakePrintEntries(points)).map(e=>e.key),order,'sorting must also work without premium links');
 const html=printDocumentHtml(entries,entries.map(e=>({question:`<p>${e.key}</p>`})),{language:'chn',mode:'questions',knowledgePoints:points,baseUrl:'http://localhost/'});
 assert.deepEqual([...html.matchAll(/data-question="([^"]+)"/g)].map(m=>m[1]),order);
});

test('textbook mistakes export their original answers, formulas and correct writing space',()=>{
 const index=JSON.parse(readFileSync('assets/textbook-exercises/index-chn.json','utf8'));
 const entries=exerciseMistakeEntries(index,[],'chn');
 const content=JSON.parse(readFileSync('assets/textbook-exercises/chn/201.json','utf8'));
 for(const number of [1,12]){
  const e=entries.find(e=>e.key===`tb-201-${number}`),r=content[e.key];
  const detailed=printableQuestion(e,r,{language:'chn',mode:'detailed'});
  assert.ok(detailed.includes(r.answer));assert.doesNotMatch(detailed,/考评局|尚待核验|0 · 1/);
  const practice=printableQuestion(e,r,{language:'chn',mode:'questions'});
  assert.match(practice,number===1?/print-choice/:/working-space/);
  assert.doesNotMatch(practice,/answer-line|answer-blank/);
  assert.ok(practice.includes(r.question));
 }
});

test('exercise progress persists, isolates accounts, toggles chapter mastery, and supports trash',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'dse-exercise-progress-'));
 let now=Date.now();let api=createApi({membershipEnabled:true,directory,adminKey:'test-only',clock:()=>now});
 const server=createServer((req,res)=>api.handler(req,res,()=>{res.statusCode=404;res.end();}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api/`;
 function client(){let cookie='';return async(path,body,method='POST')=>{const r=await fetch(base+path,{headers:{cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{method,body:JSON.stringify(body)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,...await r.json()};};}
 async function register(c,email){const otp=await c('auth/code',{email});await c('auth/verify',{email,code:otp.developmentCode});await c('profile',{nickname:'测试学生',grade:'中五',target:'5',avatar:'newton-wave',password:'Study-pass-123',confirmPassword:'Study-pass-123'},'PUT');}
 try{
  const a=client(),b=client();await register(a,'exercise-test@example.com');await register(b,'other-exercise@example.com');
  const keys=[...questions.keys()].filter(key=>key.startsWith('tb-201-'));assert.equal(keys.length,10);
  const key=keys[0];let result=await a('mistakes',{key,marked:true},'PUT');assert.equal(result.status,200);const timestamp=result.mistakes[key].markedAt;assert.equal(result.mistakes[key].chapterCode,'201');
  now+=1000;result=await a('mistakes',{key,marked:true},'PUT');assert.equal(result.mistakes[key].markedAt,timestamp);
  assert.deepEqual((await b('mistakes')).mistakes,{});
  result=await a('progress',{keys,status:'mastered'},'PUT');assert.equal(result.status,200);assert.ok(keys.every(k=>result.mastered[k]));assert.deepEqual(result.mistakes,{});
  api.close();api=createApi({membershipEnabled:true,directory,adminKey:'test-only',clock:()=>now});result=await a('mistakes');assert.ok(keys.every(k=>result.mastered[k]));
  result=await a('progress',{keys,status:'clear'},'PUT');assert.ok(keys.every(k=>!result.mastered[k]));
  await a('mistakes',{key,marked:true},'PUT');await a('mistakes',{key,marked:false},'PUT');
  assert.ok((await a('mistakes/trash')).trash.some(r=>r.key===key));
  result=await a('mistakes/trash',{action:'restore',keys:[key]});assert.ok(result.mistakes[key]);
  assert.equal((await a('mistakes',{key:'tb-201-99999',marked:true},'PUT')).status,400);
  assert.equal((await a('progress',{keys:[key,'tb-201-99999'],status:'mastered'},'PUT')).status,400);
  assert.ok((await a('mistakes')).mistakes[key]);
 }finally{await new Promise(r=>server.close(r));api.close();rmSync(directory,{recursive:true});}
});
