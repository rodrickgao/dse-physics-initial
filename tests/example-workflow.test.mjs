import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {questions,points} from '../server/catalog.mjs';
import {exampleEntries,relatedExamples} from '../src/lib/textbook-examples.js';
import {printableQuestion} from '../src/lib/study-content.js';
test('all examples use the same identities and knowledge links in readers and account catalog',()=>{
 const entries=exampleEntries([...points.values()]);assert.equal(entries.length,373);
 for(const e of entries){assert.equal(questions.get(e.key).label,`${e.chapter} · E${e.number}`);assert.deepEqual(questions.get(e.key).points,e.knowledge);}
 assert.deepEqual(relatedExamples([48]).map(e=>e.key),['ex-202-1','ex-202-2']);
});
test('example print modes preserve source content and keep answers out of the question edition',()=>{
 const e=exampleEntries().find(e=>e.key==='ex-103-6');const r=JSON.parse(fs.readFileSync('assets/textbook-examples/eng/103.json'))[e.key];
 const detailed=printableQuestion(e,r,{language:'chn',mode:'detailed'});for(const field of ['question','answer','tips','think','thinkAnswer'])assert.ok(detailed.includes(r[field]));assert.match(detailed,/103 · E6/);
 const practice=printableQuestion(e,r,{language:'chn',mode:'questions'});assert.ok(practice.includes(r.question));assert.ok(!practice.includes(r.answer));assert.ok(!practice.includes(r.thinkAnswer));
});
import {createApi} from '../server/api.mjs';import {createServer} from 'node:http';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
test('example mistakes and mastery persist through the account API and can be restored',async()=>{
 const directory=fs.mkdtempSync(join(tmpdir(),'dse-example-flow-'));const api=createApi({directory});const server=createServer((req,res)=>api.handler(req,res,()=>res.end()));await new Promise(r=>server.listen(0,'127.0.0.1',r));let cookie='';
 async function call(path,body,method='POST'){const r=await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,{headers:{cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{method,body:JSON.stringify(body)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data;}
 try{const email='examples@local.test';const otp=await call('auth/code',{email});await call('auth/verify',{email,code:otp.developmentCode});await call('profile',{nickname:'例题流程测试',grade:'中五',target:'5',avatar:'newton-wave',password:'Study-pass-123',confirmPassword:'Study-pass-123'},'PUT');
 const key='ex-202-2';assert.ok((await call('mistakes',{key,marked:true},'PUT')).mistakes[key]);await call('mistakes',{key,marked:false},'PUT');assert.ok((await call('mistakes/trash')).trash.some(r=>r.key===key));assert.ok((await call('mistakes/trash',{action:'restore',keys:[key]})).mistakes[key]);
 const progress=await call('progress',{keys:[key],status:'mastered'},'PUT');assert.ok(progress.mastered[key]);assert.ok(!progress.mistakes[key]);
 }finally{await new Promise(r=>server.close(r));api.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+ '\\'));fs.rmSync(directory,{recursive:true});}
});

