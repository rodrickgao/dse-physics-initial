import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {setImmediate as settle} from 'node:timers/promises';
import {createWeeklyReportScheduler,latestWeeklySlot,nextWeeklySlot} from '../server/weekly-report-scheduler.mjs';
import {memberWeeklyReport} from '../server/qdna-learning.mjs';

const sunday=Date.parse('2026-10-11T11:00:00Z'),week=7*86400000;
const report=(id,{start,end,language})=>({kind:'qdna-weekly',name:`Student ${id}`,start,end,language,activity:{newly_mastered:2,newly_wrong:1},focus_areas:[],recommended_questions:[]});
function database() {
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,role TEXT,created_at INTEGER);');
 for(const [id,email,role,created] of [[1,'one@test.invalid','student',sunday-week],[2,'two@test.invalid','student',sunday-week],[3,'admin@test.invalid','admin',sunday-week],[4,'later@test.invalid','student',sunday+1]])db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,email,role,created);
 return db;
}
test('weekly schedule is Sunday 19:00 Hong Kong time, including the exact boundary',()=>{
 assert.equal(nextWeeklySlot(sunday-1),sunday);
 assert.equal(latestWeeklySlot(sunday),sunday);
 assert.equal(latestWeeklySlot(sunday+3*86400000),sunday);
 assert.equal(nextWeeklySlot(sunday),sunday+week);
});
test('sends one fixed weekly report per student and does not resend after restart',async()=>{
 const db=database(),sent=[];let now=sunday-1000,builds=0;
 const options={db,clock:()=>now,from:'DDPhysics <sender@test.invalid>',buildReport:(...args)=>{builds++;return report(...args);},sendMail:async m=>sent.push(m)};
 let scheduler=createWeeklyReportScheduler(options);
 try {
  await scheduler.tick();assert.equal(sent.length,0);assert.equal(scheduler.status().nextAt,sunday);
  now=sunday;await scheduler.tick();
  assert.equal(sent.length,2);assert.equal(builds,2);assert.deepEqual(sent.map(m=>m.to),['one@test.invalid','two@test.invalid']);
  assert.match(sent[0].text,/Student 1/);assert.match(sent[0].subject,/周报/);assert.ok(sent[0].attachments.length);
  assert.equal(JSON.parse(db.prepare('SELECT report FROM weekly_report_deliveries WHERE user_id=1').get().report).start,sunday-week);
  await scheduler.tick();assert.equal(sent.length,2);
  scheduler.close();scheduler=createWeeklyReportScheduler(options);await settle();await scheduler.tick();assert.equal(sent.length,2);
  now+=week;await scheduler.tick();assert.equal(sent.length,5);assert.equal(scheduler.status().nextAt,sunday+2*week);
 }finally{scheduler.close();db.close();}
});
test('SMTP failure is retried from persisted queue with the same report and message ID',async()=>{
 const db=database();db.prepare('DELETE FROM users WHERE id<>1').run();let now=sunday-1000,attempts=0,builds=0;const sent=[];
 const options={db,clock:()=>now,from:'sender@test.invalid',buildReport:(...args)=>{builds++;return report(...args);},sendMail:async m=>{sent.push(m);if(++attempts===1)throw new Error('SMTP offline');}};
 let scheduler=createWeeklyReportScheduler(options);
 try {
  now=sunday;await scheduler.tick();assert.equal(scheduler.status().pending,1);
  await scheduler.tick();assert.equal(attempts,1);
  scheduler.close();now+=60000;scheduler=createWeeklyReportScheduler(options);await settle();await scheduler.tick();
  assert.equal(attempts,2);assert.equal(builds,1);assert.equal(scheduler.status().pending,0);assert.equal(sent[0].messageId,sent[1].messageId);
 }finally{scheduler.close();db.close();}
});
test('local preview never sends and first activation does not backfill historic weeks',async()=>{
 const db=database();let now=sunday+1000,builds=0;
 const scheduler=createWeeklyReportScheduler({db,clock:()=>now,buildReport:()=>{builds++;throw Error('unexpected');}});
 try {now+=week;await scheduler.tick();assert.equal(builds,0);assert.equal(scheduler.status().enabled,false);assert.equal(scheduler.status().nextAt,sunday+week);assert.equal(db.prepare('SELECT COUNT(*) n FROM weekly_report_deliveries').get().n,0);}finally{scheduler.close();db.close();}
});

test('queued recommendation emails recheck membership before retry without changing saved activity',async()=>{
 const db=database();db.prepare('DELETE FROM users WHERE id<>1').run();let now=sunday-1000,active=true,attempts=0;const sent=[];
 const options={db,clock:()=>now,from:'sender@test.invalid',buildReport:(id,options)=>({...report(id,options),personalized:true,recommended_questions:[{question_title:'Private recommended question',question_url:'/#paper?id=private',chapter:'Chapter',primary_knowledge:{name:'Topic'}}]}),prepareReport:(_id,saved)=>memberWeeklyReport(saved,active),sendMail:async message=>{sent.push(message);if(++attempts===1)throw Error('Fixture SMTP failure');}};
 const scheduler=createWeeklyReportScheduler(options);
 try{now=sunday;await scheduler.tick();assert.match(sent[0].text,/Private recommended question/);active=false;now+=60000;await scheduler.tick();assert.equal(sent.length,2);assert.doesNotMatch(sent[1].text,/Private recommended question|id=private/);assert.doesNotMatch(sent[1].html,/Private recommended question|id=private/);assert.match(sent[1].text,/会员专享/);assert.match(sent[1].text,/本周新增已掌握：2/);assert.equal(sent[0].messageId,sent[1].messageId);assert.equal(JSON.parse(db.prepare('SELECT report FROM weekly_report_deliveries WHERE user_id=1').get().report).recommended_questions.length,1,'Persisted report is not rewritten');assert.equal(scheduler.status().pending,0);}finally{scheduler.close();db.close();}
});
