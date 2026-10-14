import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../scripts/deep-test-fixture.mjs';
import {questions,points} from '../server/catalog.mjs';
import {coreSteps,pageTours} from '../src/lib/tour-steps.js';

test('home topics require viewing, persist by account, and return only for new related mistakes',async()=>{
 const f=await fixture('home-weak-api'),a=f.client(),b=f.client();
 try {
  await f.register(a,'weak-a@local.test');await f.register(b,'weak-b@local.test');
  const key='tb-101-1';
  const mark=async(c,key,status='mistake')=>{const r=await c.call('progress',{keys:[key],status},'PUT');assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
  const list=async(c,lang='chn')=>{const r=await c.call('weak-topics?language='+lang);assert.equal(r.status,200);return r.data.weak_points;};
  await mark(a,key);await mark(b,key);
  let p=(await list(a))[0];assert.ok(p);assert.equal(p.can_dismiss,false);
  const payload=p=>({knowledge_id:p.knowledge_id,revision:p.revision});
  assert.equal((await a.call('weak-topics/dismiss',payload(p))).status,409);
  assert.equal((await a.call('weak-topics/viewed',payload(p))).status,200);
  p=(await list(a)).find(r=>r.topic_key===p.topic_key);assert.equal(p.can_dismiss,true);
  const progressBefore=(await a.call('mistakes')).data;
  assert.equal((await a.call('weak-topics/dismiss',payload(p))).status,200);
  assert.equal((await list(a)).some(r=>r.topic_key===p.topic_key),false);
  assert.deepEqual((await a.call('mistakes')).data,progressBefore,'dismiss does not touch mistakes/mastery');
  assert.equal((await list(b))[0].can_dismiss,false,'reading is scoped to each account');
  assert.equal((await list(b)).some(r=>r.topic_key===p.topic_key),true);
  assert.equal((await list(a,'eng')).some(r=>r.topic_key===p.topic_key),false,'language does not change dismissal');
  f.restart();assert.equal((await list(a)).some(r=>r.topic_key===p.topic_key),false,'restart preserves dismissal');
  assert.equal((await a.call('mistakes/trash',{action:'trash',all:true,expectedCount:1})).status,200);
  assert.equal((await a.call('mistakes/trash',{action:'restore',keys:[key]})).status,200);
  assert.equal((await list(a)).some(r=>r.topic_key===p.topic_key),false,'restoring an old mistake is not a new wrong answer');
  await mark(a,key);assert.equal((await list(a)).some(r=>r.topic_key===p.topic_key),false,'idempotent marks do not revive');
  const relatedIds=[...points].filter(([,point])=>String(point.card_sequence)===p.topic_key).map(([id])=>id);
  const unrelated=[...questions.values()].find(q=>q.source==='textbook'&&q.points.length&&q.points.every(id=>!relatedIds.includes(id)));
  await mark(a,unrelated.key);assert.equal((await list(a)).some(r=>r.topic_key===p.topic_key),false);
  const other=[...questions.values()].find(q=>q.key!==key&&q.source==='textbook'&&q.points.some(id=>relatedIds.includes(id)));
  assert.ok(other);await mark(a,other.key);
  let revived=(await list(a)).find(r=>r.topic_key===p.topic_key);assert.ok(revived);assert.equal(revived.can_dismiss,false);assert.ok(revived.revision>p.revision);
  assert.equal((await a.call('weak-topics/dismiss',payload(p))).status,409,'stale tabs cannot dismiss a new mistake');
  assert.equal((await a.call('weak-topics/viewed',payload(p))).status,409,'stale readings cannot unlock a cross');
  assert.equal((await a.call('weak-topics/viewed',payload(revived))).status,200);
  assert.equal((await a.call('weak-topics/dismiss',payload(revived))).status,200);
  await mark(a,other.key,'mastered');await mark(a,other.key);
  revived=(await list(a)).find(r=>r.topic_key===p.topic_key);assert.ok(revived);assert.equal(revived.can_dismiss,false,'same-clock repeated wrong transitions reactivate');
  const body=JSON.stringify(await list(a));assert.doesNotMatch(body,/practice|recommendations|weakness|wrong_question_count/);
  assert.equal((await a.call('weak-topics/viewed',{...payload(revived),studentId:2})).status,400);
  assert.equal((await a.call('weak-topics?studentId=2')).status,400);
  assert.equal((await a.call('weak-topics/viewed',{...payload(revived),revision:-1})).status,400);
  assert.equal((await f.client().call('weak-topics')).status,401);
 }finally{await f.close();}
});

test('weak-topic tutorials use home, keep step eight read-only and omit exercise recommendations',()=>{
 const eight=coreSteps[7],nine=coreSteps[8];
 assert.deepEqual(eight.route,['home']);assert.equal(eight.interactive,false);
 assert.deepEqual(nine.route,['home']);assert.deepEqual(nine.advanceOnNavigate,['textbook']);
 assert.doesNotMatch(JSON.stringify([eight,nine]),/推荐题|recommended|textbook exercises/i);
 assert.ok(pageTours.mistakes.every(s=>!JSON.stringify(s.target).includes('knowledge-profile')));
});
