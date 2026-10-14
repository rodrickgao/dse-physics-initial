import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../server/api.mjs';
import { questions } from '../server/catalog.mjs';
import { compareMistakePrintEntries, printDocumentHtml } from '../src/lib/study-content.js';

test('source precedes type, and each type follows chapters including elective book order',()=>{
 const make=(key,source,chapter,kind)=>({key,source,exerciseChapter:source==='past-paper'?undefined:chapter,primaryChapterCode:chapter,paperIndex:2,question:{label:key,kind},year:{year:2024}});
 const entries=[
  make('past-choice','past-paper','101','multiple-choice'),
  make('exercise-structured','textbook','101','structured'),
  make('exercise-e3','textbook','E301','multiple-choice'),
  make('example-late','examples','E403','structured'),
  make('exercise-e2','textbook','E201','multiple-choice'),
  make('example-early','examples','201','structured'),
  make('exercise-choice','textbook','201','multiple-choice'),
  make('past-structured','past-paper','101','structured'),
 ];
 const expected=['example-early','example-late','exercise-choice','exercise-e2','exercise-e3','exercise-structured','past-choice','past-structured'];
 assert.deepEqual([...entries].sort(compareMistakePrintEntries()).map(e=>e.key),expected);
 for(const language of ['chn','eng']) for(const mode of ['questions','detailed']) {
  const contents=entries.map(e=>({kind:e.question.kind,question:`<p>${e.key}</p>`,answer:'<p>B</p>'}));
  const html=printDocumentHtml(entries,contents,{language,mode,baseUrl:'http://localhost/'});
  assert.deepEqual([...html.matchAll(/data-question="([^"]+)"/g)].map(m=>m[1]),expected);
  const choiceArticles=[...html.matchAll(/<article class="print-question print-choice[^>]*>[\s\S]*?<\/article>/g)];
  assert.equal(choiceArticles.length,4);
  assert.ok(choiceArticles.every(m=>!m[0].includes('working-space')));
 }
});

test('loaded choice metadata controls print sorting and removes elective writing boxes',()=>{
 const entries=['structured','elective-choice'].map(key=>({key,paperIndex:2,primaryChapterCode:key==='structured'?'101':'E101',year:{year:2024},question:{label:key}}));
 const html=printDocumentHtml(entries,[{kind:'structured',question:'<p>LONG</p>'},{kind:'multiple-choice',question:'<p>CHOICE</p>'}],{language:'chn',mode:'questions',baseUrl:'http://localhost/'});
 assert.deepEqual([...html.matchAll(/data-question="([^"]+)"/g)].map(m=>m[1]),['elective-choice','structured']);
 assert.doesNotMatch(html.match(/<article[^>]+data-question="elective-choice"[\s\S]*?<\/article>/)[0],/working-space|answer-line/);
});

test('saved order and kinds agree for all legacy account states without exposing paid mappings',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'dse-mistake-order-'));
 const api=createApi({membershipEnabled:true,directory,adminKey:'isolated-order-test'});
 const server=createServer((req,res)=>api.handler(req,res,()=>{res.writeHead(404);res.end();}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api/`;
 const client=()=>{let cookie='';return async(route,body,method='POST')=>{
  const response=await fetch(base+route,{headers:{cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{method,body:JSON.stringify(body)}:{})});
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
  assert.equal(response.status,200,route);return response.json();
 };};
 try {
  const student=client(),admin=client();const otp=await student('auth/code',{email:'order-test@local.test'});
  const auth=await student('auth/verify',{email:'order-test@local.test',code:otp.developmentCode});
  await student('profile',{nickname:'排序检查',grade:'中五',target:'5',password:'Isolated-order-123',confirmPassword:'Isolated-order-123'},'PUT');
  const choose=(source,chapter,kind)=>[...questions.values()].find(q=>(q.source||'past-paper')===source&&(q.exerciseChapter||q.primaryChapterCode)===chapter&&q.kind===kind)?.key;
  const expected=[choose('examples','101','structured'),choose('examples','E301','structured'),choose('textbook','201','multiple-choice'),choose('textbook','E201','multiple-choice'),choose('textbook','E301','multiple-choice'),choose('textbook','101','structured'),choose('past-paper','103','multiple-choice'),choose('past-paper','E101','multiple-choice'),choose('past-paper','101','structured')];
  assert.ok(expected.every(Boolean));
  for(const key of [...expected].reverse())await student('mistakes',{key,marked:true},'PUT');
  const before=await student('mistakes');
  for(const member of [false,true]) {
   if(member){await admin('admin/login',{key:'isolated-order-test'});await admin('admin/membership',{userId:auth.user.id,action:'extend',days:30,reason:'Ordering regression',revision:0,requestId:crypto.randomUUID()});}
   for(const language of ['chn','eng']) {
    const summary=await student(`content/mistake-summary?language=${language}`);
    assert.deepEqual(summary.orderedKeys,expected);
    assert.deepEqual(summary.questionKinds,Object.fromEntries(expected.map(key=>[key,questions.get(key).kind])));
    assert.equal(summary.chapters.reduce((sum,c)=>sum+c.multipleChoice,0),5);
    assert.equal(summary.chapters.reduce((sum,c)=>sum+c.structured,0),4);
    if(member)assert.ok(summary.pointCount>0);else assert.equal(summary.pointCount,0);
    const elective=expected[7];const detail=await student(`content/question?language=${language}&id=${encodeURIComponent(elective)}`);
    assert.equal(detail.kind,'multiple-choice');
    if(member){assert.ok(detail.reasoning);assert.ok(detail.network);}else assert.equal(detail.reasoning,undefined);
   }
  }
  assert.deepEqual(await student('mistakes'),before,'sorting and printing metadata do not change progress');
 } finally {await new Promise(r=>server.close(r));api.close();rmSync(directory,{recursive:true});}
});
