import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createApi} from '../server/api.mjs';
import {points} from '../server/catalog.mjs';

test('restored paid mode applies membership restrictions to legacy states and preserves closed chapter PDFs',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'ddphysics-free-access-'));let now=Date.now();
 const api=createApi({membershipEnabled:true,directory,clock:()=>now,adminKey:'isolated-free-test'});
 const server=createServer((req,res)=>api.handler(req,res,()=>{if(!api.protectFiles(req,res)){res.writeHead(404);res.end();}}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const db=new DatabaseSync(join(directory,'students.sqlite'));
 const client=()=>{let cookie='';return async(path,body)=>{
  const r=await fetch(base+path,{headers:{cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
  if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,...await r.json()};
 };};
 try{
  for(const state of ['none','active','expired','revoked']){
   const c=client(),email=`${state}@local.test`;const code=await c('/api/auth/code',{email});const auth=await c('/api/auth/verify',{email,code:code.developmentCode});assert.equal(auth.status,200);
   if(state!=='none')db.prepare('INSERT INTO memberships VALUES(?,?,?,?)').run(auth.user.id,now+(state==='expired'?-1:86400000),state==='revoked'?1:0,3);
   const before=db.prepare('SELECT * FROM memberships WHERE user_id=?').get(auth.user.id);
   for(const language of ['chn','eng']){
    for(const id of ['2025|paper-1a|1','2012|paper-2|1.3','tb-201-1','tb-E201-1','ex-201-1']){
     const detail=await c(`/api/content/question?language=${language}&id=${encodeURIComponent(id)}`);
     assert.equal(detail.status,200,`${state}/${language}/${id}`);assert.ok(detail.question);if(state==='active'){assert.ok(detail.reasoning||detail.answer);assert.ok(detail.network);}else{assert.equal(detail.reasoning,undefined);assert.equal(detail.premiumLocked,true);}
    }
    const links=await c(`/api/content/links?id=ex-201-1&language=${language}`);assert.equal(links.status,state==='active'?200:403);if(state==='active')assert.ok(links.links.length);
    const recommendations=await c(`/learning/knowledge?id=48&language=${language}`.replace('/learning','/api/learning'));assert.equal(recommendations.status,200);assert.equal(Boolean(recommendations.recommendations.locked),state!=='active');
    const summary=await c(`/api/content/mistake-summary?language=${language}`);assert.deepEqual(summary.orderedKeys,[]);
   }
   assert.equal((await c('/api/tutoring')).status,state==='active'?200:403);
   assert.equal((await c('/api/membership')).membership.status,state);
   assert.deepEqual(db.prepare('SELECT * FROM memberships WHERE user_id=?').get(auth.user.id),before,'free reads do not rewrite historical account state');
  }
  const chapters=[...new Set([...points.values()].map(p=>p.code))];assert.equal(chapters.length,46);
  let count=0;
  for(const language of ['chn','eng'])for(const code of chapters){
   if(count%10===0)now+=61000;
   const r=await fetch(`${base}/assets/textbook/pdfs/${language}/${code}.pdf`,{method:'HEAD'});
   assert.equal(r.status,404,`${language}/${code}`);count++;
  }
  assert.equal(count,92);
  assert.equal((await fetch(base+'/api/learning/dashboard')).status,401,'personal records still require an account');
  assert.equal((await fetch(base+'/api/admin/content/dna?id=2012%7Cpaper-1a%7C1')).status,401);
 }finally{db.close();await new Promise(r=>server.close(r));api.close();rmSync(directory,{recursive:true});}
});
