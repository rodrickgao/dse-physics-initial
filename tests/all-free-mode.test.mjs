import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../scripts/deep-test-fixture.mjs';
import {points} from '../server/catalog.mjs';
import {MEMBERSHIP_ENABLED} from '../src/lib/access-policy.js';
import {readRoute} from '../src/lib/study-state.js';
import {readAdminLocation} from '../src/lib/admin-location.js';
import ExcelJS from 'exceljs';
import {memberWeeklyReport} from '../server/qdna-learning.mjs';

test('free default grants complete learning to all historical states without altering memberships or taking payments',{skip:MEMBERSHIP_ENABLED},async()=>{
 assert.equal(MEMBERSHIP_ENABLED,false);
 const sent=[];const f=await fixture('all-free',{paymentNotifier:async value=>sent.push(value)});
 try {
  const admin=f.client();assert.equal((await admin.call('admin/login',{key:'isolated-deep-test-key'})).status,200);
  for(const state of ['none','active','expired','revoked']){
   const c=f.client(),u=await f.register(c,`${state}@local.test`);
   if(state!=='none')f.db.prepare('INSERT INTO memberships VALUES(?,?,?,?)').run(u.id,f.clock()+(state==='expired'?-1:86400000),state==='revoked'?1:0,3);
   const membership=f.db.prepare('SELECT * FROM memberships WHERE user_id=?').get(u.id);
   for(const language of ['chn','eng']){
    f.advance(61000);
    for(const id of ['2025|paper-1a|1','2012|paper-2|1.3','tb-201-1','tb-E201-1','ex-201-1']){
     const r=await c.call(`content/question?language=${language}&id=${encodeURIComponent(id)}`);
     assert.equal(r.status,200);assert.equal(r.data.premiumLocked,false);assert.equal(typeof r.data.reasoning,'string');assert.ok(r.data.network);
     assert.equal((await c.call(`content/links?language=${language}&id=${encodeURIComponent(id)}`)).status,200);
    }
    const details=await c.call(`learning/knowledge?id=48&language=${language}`);assert.equal(details.status,200);assert.ok(!details.data.recommendations.locked);assert.ok(!details.data.recommendations.trialOnly);
    const report=f.api().buildWeeklyReport(u.id,{language,start:f.clock()-7*86400000,end:f.clock()});assert.ok(!report.recommendations_trial_only);
   }
   assert.equal((await c.call('tutoring')).status,200);
   assert.equal((await c.call('activity',{action:'reasoning_view',target:'tb-201-1',eventId:crypto.randomUUID()})).status,200);
   assert.equal((await c.call('orders',{method:'wechat'})).status,410);
   assert.equal((await admin.call('admin/membership',{userId:u.id,action:'extend',days:30,reason:'test',revision:3,requestId:crypto.randomUUID()})).status,410);
   assert.equal((await admin.call('admin/orders/review',{id:'test',action:'approve'})).status,410);
   assert.deepEqual(f.db.prepare('SELECT * FROM memberships WHERE user_id=?').get(u.id),membership);
   assert.equal((await c.call('membership')).data.membership.status,state);
   assert.equal((await c.call('mistakes',{key:'tb-201-1',marked:true},'PUT')).status,200);
   assert.deepEqual((await c.call('content/mistake-summary')).data.orderedKeys,['tb-201-1']);
  }
  const c=f.client(),u=await f.register(c,'download@local.test');
  for(const language of ['chn','eng'])for(const code of new Set([...points.values()].map(p=>p.code))){
   f.advance(61000);
   const r=await fetch(f.base+`assets/textbook/pdfs/${language}/${code}.pdf`,{method:'HEAD',headers:{cookie:c.cookie()}});assert.equal(r.status,404);assert.equal(r.headers.get('cache-control'),'no-store');
   assert.equal((await fetch(f.base+`assets/textbook/pdfs/${language}/${code}.pdf?download=1`,{headers:{cookie:admin.cookie()}})).status,404);
   assert.equal((await fetch(f.base+`assets/textbook/pdfs/${language}/${code}.pdf`,{method:'HEAD'})).status,404);
  }
  const book=new ExcelJS.Workbook();const exported=await admin.call('admin/export');await book.xlsx.load(Buffer.from(exported.data.base64,'base64'));assert.equal(book.getWorksheet('学生学习').columnCount,17);assert.doesNotMatch(book.getWorksheet('学生学习').getRow(1).values.join(' '),/会员|到期/);
  assert.equal((await f.client().call('learning/dashboard')).status,401);assert.equal((await c.call('admin/overview')).status,403);
  for(const path of ['server/api.mjs','output/free-site-20261014/membership-backup/server/api.mjs','text-papers/2025-eng.json','assets/textbook-exercises/eng/201.json'])assert.equal((await fetch(f.base+path)).status,404);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM payment_orders').get().n,0);assert.deepEqual(sent,[]);
 }finally{await f.close();}
});

test('old subscription routes return home and old admin filters clear in free mode',{skip:MEMBERSHIP_ENABLED},()=>{
 for(const route of ['membership','payment','receipt','activating','member-success'])assert.equal(readRoute('#'+route).page,'home');
 for(const route of ['payments','audit'])assert.equal(readAdminLocation('#'+route+'?filter=active').tab,'overview');
 assert.equal(readAdminLocation('#users?filter=active').filter,'all');
});

test('pending trial-only weekly reports gain full recommendations while retaining the original week and learning statistics',()=>{
 const report={start:1,end:2,activity:{newly_wrong:4,newly_mastered:2},focus_areas:[{knowledge_id:'48'}],recommended_questions:[],recommendations_trial_only:true,personalized:false};
 const questions=[{question_id:'tb-201-1'}];const prepared=memberWeeklyReport(report,true,questions);
 assert.deepEqual(prepared.recommended_questions,questions);assert.equal(prepared.recommendations_trial_only,false);assert.equal(prepared.personalized,true);assert.equal(prepared.activity,report.activity);assert.equal(prepared.focus_areas,report.focus_areas);assert.equal(prepared.start,1);assert.equal(prepared.end,2);assert.deepEqual(report.recommended_questions,[]);
});
