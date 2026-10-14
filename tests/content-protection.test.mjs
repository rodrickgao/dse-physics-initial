import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createContentLimiter } from '../server/content-limits.mjs';
import { points, questions } from '../server/catalog.mjs';
import { createApi } from '../server/api.mjs';

test('content boundary: trial, membership, static bypasses, bounded results, cooldown and account isolation', async () => {
 const directory=mkdtempSync(join(tmpdir(),'dse-protection-'));let now=Date.now();
 const dnaDirectory=join(directory,'dna');
 for(const label of ['中文版','英文版']) {const folder=join(dnaDirectory,label,'json');mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'QDNA.json'),JSON.stringify([{question_id:'2012|paper-1a|1',knowledge_weights:[{knowledge_id:16,weight:1,evidence:'Fixture evidence'}],reasoning_steps:['Fixture step'],issues:[]}]));}
 const api=createApi({membershipEnabled:true,directory,adminKey:'fixture-only-key',clock:()=>now,qdnaDirectory:dnaDirectory,contentLimits:{detail:8}});
 const server=createServer((req,res)=>api.handler(req,res,()=>{if(!api.protectFiles(req,res)){res.writeHead(404);res.end();}}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const client=()=>{let cookie='';return async(path,body)=>{const r=await fetch(base+path,{headers:{cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data=raw;}return {status:r.status,data,headers:r.headers};};};
 const guest=client(),free=client(),member=client(),admin=client();
 const login=async(c,email)=>{const sent=await c('/api/auth/code',{email});assert.equal(sent.status,200);const verified=await c('/api/auth/verify',{email,code:sent.data.developmentCode});assert.equal(verified.status,200);return verified.data.user;};
 try {
  const memberUser=await login(member,'member@test.example');await login(free,'free@test.example');
  const emptySummary=await free('/api/content/mistake-summary?language=eng');
  assert.equal(emptySummary.status,200);assert.deepEqual(emptySummary.data.orderedKeys,[]);
  assert.equal((await admin('/api/admin/login',{key:'fixture-only-key'})).status,200);
  assert.equal((await admin('/api/admin/membership',{userId:memberUser.id,action:'extend',days:1,reason:'test',revision:0,requestId:crypto.randomUUID()})).status,200);
  const dna='/api/admin/content/dna?id=2012%7Cpaper-1a%7C1&language=chn';
  assert.equal((await guest(dna)).status,401);assert.equal((await member(dna)).status,403);
  const annotation=await admin(dna);assert.equal(annotation.status,200);assert.ok(annotation.data.knowledge_weights.length);
  assert.equal((await member('/api/content/dna?id=2012%7Cpaper-1a%7C1')).status,404);
  const route='/api/content/question?id=2025%7Cpaper-1a%7C1&language=eng';
  for(const c of [guest,free]) {const r=await c(route);assert.equal(r.status,200);assert.ok(r.data.question);assert.equal(r.data.reasoning,undefined);assert.ok(!r.data.network||r.data.network.links.every(l=>points.get(l.sequence)?.book_key==='compulsory-1'));assert.equal(r.data.source,undefined);}
  const paid=await member(route);assert.equal(paid.status,200);assert.ok(paid.data.reasoning);assert.equal(paid.data.watermark,undefined);for(const field of ['answer','reasoning','thinkAnswer'])assert.doesNotMatch(paid.data[field]||'',/DDPhysics · U-/);assert.equal(paid.headers.get('cache-control'),'private, no-store');
  for(const path of ['/text-papers/2025-eng.json','/assets/textbook-exercises/eng/101.json','/assets/textbook-examples/chn/102.json','/assets/textbook-examples/index-eng.json','/.local-membership-preview/students.sqlite','/.env.local','/server/api.mjs','/src/lib/textbook-example-knowledge.json','/downloads/eng/knowledge.pdf','/assets/textbook/pdfs/eng/101.pdf','/%2eenv.local']) {
    assert.equal((await guest(path)).status,404,path);assert.equal((await member(path)).status,404,path);
  }
  assert.equal((await member('/api/premium/network')).status,410);
  assert.equal((await guest('/api/content/links?id=ex-201-1')).status,401);
  assert.equal((await free('/api/content/links?id=ex-201-1')).status,403);
  for(const c of [guest,free]) {
   for(const id of ['ex-101-1','ex-105-1','tb-101-1']) {const trial=await c('/api/content/links?id='+id);assert.equal(trial.status,200,id);assert.ok(trial.data.links.every(l=>points.get(l.sequence)?.book_key==='compulsory-1'));}
   const relatedTrial=await c('/api/content/related?points=2&limit=2');assert.equal(relatedTrial.status,200);assert.ok(relatedTrial.data.results.length<=2);assert.ok(relatedTrial.data.results.every(q=>[...questions.get(q.key).points,...(questions.get(q.key).relatedPoints||[])].includes(2)));
   const locked=[...points.values()].find(p=>p.book_key==='compulsory-2').sequence;
   assert.ok([401,403].includes((await c('/api/content/related?points=2,'+locked)).status));
   assert.equal((await c('/api/content/related?points=2&limit=9999')).status,400);
  }
  const links=await member('/api/content/links?id=ex-102-1');assert.equal(links.status,200);assert.ok(links.data.links.length);
  assert.ok(links.data.links.every(l=>Object.keys(l).every(k=>['sequence','chapterZh','chapterEn'].includes(k))));
  for(const suffix of ['limit=999999','limit=0','offset=-1','limit=1&limit=2','ids=1,2','userId=1','active=true']) assert.equal((await member('/api/content/search?q=heat&'+suffix)).status,400,suffix);
  const search=await member('/api/content/search?q=heat&language=eng&limit=3');assert.equal(search.status,200);assert.equal(search.data.results.length,3);assert.ok(search.data.hasMore);assert.ok(search.data.results.every(r=>!('score' in r)&&!('network' in r)&&!('reasoning' in r)));
  const next=await member('/api/content/search?q=heat&language=eng&limit=3&offset=3');assert.ok(next.data.results.every(r=>!search.data.results.some(q=>q.key===r.key)));
  const related=await member('/api/content/related?points=2&limit=2');assert.equal(related.status,200);assert.ok(related.data.results.length<=2);
  assert.equal((await member('/api/content/related?points='+Array(13).fill('2').join(','))).status,400);
  const nav=await guest('/api/content/directory?source=textbook&chapter=101');assert.equal(nav.data.questions.length,10);assert.ok(nav.data.questions.every(q=>!q.question&&!q.answer&&!q.preview&&q.knowledge.length===0));
  for(const id of ['tb-101-1','ex-102-1']) {const r=await member('/api/content/question?id='+id);assert.equal(r.status,200);assert.ok(r.data.question);assert.ok(r.data.answer);}
  // Find an actual paid-only diagram, ensuring there is no static-file fallback.
  const privateImage='/assets/textbook-exercises/media/a61d0435fbf00d0fc3c04854.png';
  assert.equal((await guest(privateImage)).status,401);assert.equal((await free(privateImage)).status,403);
  assert.equal((await member(privateImage)).status,200);
  let limited;for(let i=0;i<12;i++){limited=await member(route);if(limited.status===429)break;}assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
  assert.equal((await free(route)).status,200,'a shared IP does not share the account cooldown');
  now+=61000;assert.equal((await member(route)).status,200);
  // Expiration is rechecked per request, with no stale content cache at the server.
  now+=2*86400000;const expired=await member(route);assert.equal(expired.data.reasoning,undefined);assert.equal((await member('/api/content/links?id=ex-201-1')).status,403);
 } finally {await new Promise(resolve=>server.close(resolve));api.close();rmSync(directory,{recursive:true});}
});

test('hourly distinct-question guard survives limiter recreation and keeps accounts independent',()=>{
 const db=new DatabaseSync(':memory:');let now=7200000;
 const res={setHeader:()=>{}},req=id=>({url:`/api/content/question?id=${id}`,socket:{remoteAddress:'127.0.0.1'}});
 try {
  let limit=createContentLimiter({db,clock:()=>now,config:{detail:100,distinctHour:2}});
  limit(req('a'),res,{id:1},'detail');limit(req('b'),res,{id:1},'detail');limit(req('a'),res,{id:1},'detail');
  limit=createContentLimiter({db,clock:()=>now,config:{detail:100,distinctHour:2}});
  assert.throws(()=>limit(req('c'),res,{id:1},'detail'),e=>e.status===429);
  assert.doesNotThrow(()=>limit(req('c'),res,{id:2},'detail'));
  now+=3600001;assert.doesNotThrow(()=>limit(req('c'),res,{id:1},'detail'));
 }finally{db.close();}
});

test('public build excludes raw question packs, DNA and recommendation implementation',()=>{
 const root=new URL('../dist/',import.meta.url);const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(new URL(e.name+'/',dir)):[new URL(e.name,dir)]);
 const files=walk(root);assert.ok(!files.some(f=>/text-papers|textbook-examples|textbook-exercises|\.sqlite|QDNA|\.map$/.test(f.pathname)));
 for(const f of files.filter(f=>/\.js$/.test(f.pathname))){const code=readFileSync(f,'utf8');for(const marker of ['knowledge_weights','reasoning_steps','sourcesByPoint','calculateKnowledgeWeakness','getRecommendedQuestions','bodyConcepts','metadataPhrase','fixture-only-key'])assert.ok(!code.includes(marker),`${f.pathname}: ${marker}`);}
 const navigation=readFileSync(new URL('site-data.js',root),'utf8');assert.ok(!navigation.includes('answerText'));assert.ok(!navigation.includes('"answer":'));
});
