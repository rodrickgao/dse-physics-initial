import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../server/api.mjs';
import { questions } from '../server/catalog.mjs';
import { studentLearning } from '../server/student-learning.mjs';
import { profileReview } from '../src/lib/profile-review.js';

test('admin recommendations use the student algorithm and only current mistakes', () => {
 const entries = [...questions.values()].map(q=>({...q,network:{links:q.points.map(sequence=>({sequence}))}}));
 const key = '2012|paper-1a|1';
 const rows = [{question_key:key,marked_at:123}];
 const archive = [{...rows[0],status:'active'},{question_key:'2012|paper-1a|8',status:'trash'},{question_key:'2012|paper-1a|23',status:'deleted'}];
 for (const batch of [0,1,2]) {
  const result = studentLearning(rows,[],archive,batch);
  const expected = profileReview(entries,{[key]:true},'chn',batch);
  assert.deepEqual(result.review.questions.map(q=>q.key),expected.questions.map(q=>q.key));
  assert.deepEqual(result.counts,{active:1,mastered:0,trash:1,deleted:1});
  assert.ok(result.review.questions.every(q=>q.key.startsWith('tb-')&&q.knowledge.length));
 }
 assert.equal(studentLearning([],[],archive).review.questions.length,0);
});

test('admin learning detail and overview follow mastery, trash and restoration without leaking to students',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'dse-admin-learning-'));
 const api=createApi({directory,adminKey:'test-admin-learning'});
 const server=createServer((req,res)=>api.handler(req,res,()=>{res.statusCode=404;res.end();}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api/`;
 function client(){const cookies=new Map();return async(path,body,method='POST')=>{const r=await fetch(base+path,{headers:{cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(body?{'Content-Type':'application/json'}:{})},...(body?{method,body:JSON.stringify(body)}:{})});const c=r.headers.get('set-cookie');if(c){const [k,v]=c.split(';')[0].split('=');cookies.set(k,v);}return {status:r.status,...await r.json()};};}
 try{
  const student=client(),admin=client();
  const otp=await student('auth/code',{email:'admin-learning@example.com'});
  const login=await student('auth/verify',{email:'admin-learning@example.com',code:otp.developmentCode});
  const id=login.user.id;
  await student('profile',{nickname:'测试学生',grade:'中五',target:'5',avatar:'newton-wave',password:'Study-pass-123',confirmPassword:'Study-pass-123'},'PUT');
  assert.equal((await student(`admin/student?id=${id}`)).status,403);
  await admin('admin/login',{key:'test-admin-learning'});
  const key='tb-103-1';
  await student('mistakes',{key,marked:true},'PUT');
  let detail=await admin(`admin/student?id=${id}`);
  assert.equal(detail.learning.counts.active,1);
  assert.ok(!detail.learning.review.questions.some(q=>q.key===key));
  await student('progress',{keys:[key],status:'mastered'},'PUT');
  detail=await admin(`admin/student?id=${id}`);
  assert.equal(detail.learning.counts.active,0);assert.equal(detail.learning.counts.mastered,1);
  assert.equal(detail.learning.mastered[0].key,key);
  let overview=await admin('admin/overview');
  assert.equal(overview.students.find(s=>s.id===id).mastered,1);
  assert.equal(overview.students.find(s=>s.id===id).activeMistakes,0);
  await student('mistakes',{key,marked:true},'PUT');
  await student('mistakes',{key,marked:false},'PUT');
  detail=await admin(`admin/student?id=${id}`);
  assert.equal(detail.learning.counts.trash,1);assert.equal(detail.learning.counts.mastered,0);
  await student('mistakes/trash',{action:'restore',keys:[key]});
  detail=await admin(`admin/student?id=${id}`);
  assert.equal(detail.learning.counts.active,1);assert.equal(detail.learning.counts.trash,0);
 }finally{await new Promise(r=>server.close(r));api.close();rmSync(directory,{recursive:true});}
});
