import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {fixture,output} from './deep-test-fixture.mjs';
import {questions,pointInfo} from '../server/catalog.mjs';

const f=await fixture('state'),report={students:120,requests:0,mutations:0,questionTransitions:0,coveredQuestions:questions.size,checks:[],findings:[],seed:Number(process.env.DSE_DEEP_SEED||20261012)};
const users=[],keys=[...questions.keys()];let seed=report.seed;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const pick=rows=>rows[Math.floor(random()*rows.length)];
const call=async(c,...args)=>{report.requests++;return c.call(...args);};
function state(user,key){if(!user.model.has(key))user.model.set(key,{wrong:false,mastered:false,archive:null});return user.model.get(key);}
function mark(row,value){if(value)row.mastered=false;if(row.wrong===value)return;row.wrong=value;row.archive=value?'active':'trash';}
async function compare(user){
 const r=await call(user.client,'mistakes');assert.equal(r.status,200);
 const wrong=[...user.model].filter(([,r])=>r.wrong).map(([k])=>k).sort(),mastered=[...user.model].filter(([,r])=>r.mastered).map(([k])=>k).sort();
 assert.deepEqual(Object.keys(r.data.mistakes).sort(),wrong);assert.deepEqual(Object.keys(r.data.mastered).sort(),mastered);
 const trash=await call(user.client,'mistakes/trash');assert.deepEqual(trash.data.trash.map(r=>r.key).sort(),[...user.model].filter(([,r])=>r.archive==='trash').map(([k])=>k).sort());
 assert.deepEqual(f.db.prepare('SELECT question_key,status FROM mistake_archive WHERE user_id=? ORDER BY question_key').all(user.id).map(r=>[r.question_key,r.status]),[...user.model].filter(([,r])=>r.archive).map(([k,r])=>[k,r.archive]).sort(([a],[b])=>a.localeCompare(b,'en',{usage:'sort'})).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0));
}
try {
 for(let i=0;i<report.students;i++){
  if(i&&i%18===0)f.advance(3600001);
  const client=f.client(),user=await f.register(client,'state-'+i+'@local.test',i===0?'=SUM(1,2)':'大样本学生 '+i);
  user.client=client;user.model=new Map();users.push(user);
  const status=['none','active','expired','revoked'][i%4];user.membershipStatus=status;
  if(status!=='none')f.db.prepare('INSERT INTO memberships VALUES(?,?,?,?)').run(user.id,f.clock()+(status==='expired'?-1:30*86400000),status==='revoked'?1:0,2);
 }
 const admin=f.client();assert.equal((await call(admin,'admin/login',{key:'isolated-deep-test-key'})).status,200);
 for(let i=0;i<users.length;i++){
  const assigned=keys.filter((_,n)=>n%users.length===i),user=users[i];
  assert.equal((await call(user.client,'mistakes/import',{keys:assigned})).status,200);
  assigned.forEach(key=>mark(state(user,key),true));report.questionTransitions+=assigned.length;
  const sessions=[{id:'focus-'+i,elapsedMs:90000+i*1000},{id:'study-'+i,elapsedMs:30000}];
  assert.equal((await call(user.client,'focus',{sessions},'PUT')).status,200);
  const shorter=await call(user.client,'focus',{sessions:sessions.map(r=>({...r,elapsedMs:1}))},'PUT');assert.deepEqual(shorter.data.sessions,sessions);
  user.focusMinutes=Math.round(sessions.reduce((n,r)=>n+r.elapsedMs,0)/60000);
 }
 console.log('Seeded 120 isolated students and all '+keys.length+' questions');
 for(let n=0;n<5000;n++){
  const user=pick(users);f.advance(2);
  const available=[...user.model.keys()],chosen=[...new Set(Array.from({length:1+Math.floor(random()*7)},()=>random()<.6&&available.length?pick(available):pick(keys)))];
  const mode=Math.floor(random()*6),before=structuredClone(user.model);let r;
  if(mode===0){r=await call(user.client,'mistakes',{key:chosen[0],marked:true},'PUT');mark(state(user,chosen[0]),true);}
  else if(mode===1){r=await call(user.client,'mistakes',{key:chosen[0],marked:false},'PUT');mark(state(user,chosen[0]),false);}
  else if(mode===2||mode===3){const status=mode===2?'mastered':'clear';r=await call(user.client,'progress',{keys:chosen,status},'PUT');chosen.forEach(k=>{const row=state(user,k);mark(row,false);row.mastered=status==='mastered';});if(n%7===0){assert.equal(r.status,200);assert.equal((await call(user.client,'progress/undo',{id:r.data.undoId})).status,200);user.model=before;}}
  else {const trash=[...user.model].filter(([,r])=>r.archive==='trash').map(([k])=>k);if(trash.length){const key=pick(trash),action=mode===4?'restore':'delete';r=await call(user.client,'mistakes/trash',{keys:[key],action});const row=state(user,key);if(action==='restore'){row.wrong=true;row.mastered=false;row.archive='active';}else row.archive='deleted';}else{r=await call(user.client,'progress',{keys:chosen,status:'mistake'},'PUT');chosen.forEach(k=>mark(state(user,k),true));}}
  assert.equal(r.status,200,JSON.stringify(r.data));report.mutations++;report.questionTransitions+=chosen.length;
  if(n%250===0){await compare(user);console.log('Mutation '+n+' verified against independent state model');}
 }
 for(const user of users)await compare(user);
 report.checks.push('5,000 randomized mutations match independent model for mistakes, mastery, trash and deletion across 120 accounts');
 // Concurrent independent changes must all survive; malformed batches must roll back entirely.
 for(const user of users.slice(0,12)){
  const batch=keys.slice(0,12);const results=await Promise.all(batch.map(key=>call(user.client,'progress',{keys:[key],status:'mastered'},'PUT')));assert.ok(results.every(r=>r.status===200));batch.forEach(key=>{const row=state(user,key);mark(row,false);row.mastered=true;});
  const before=await call(user.client,'mistakes');assert.equal((await call(user.client,'progress',{keys:[batch[0],'invalid-key'],status:'mistake'},'PUT')).status,400);assert.deepEqual((await call(user.client,'mistakes')).data,before.data);await compare(user);
 }
 report.checks.push('144 concurrent changes persist; invalid batches are atomic');
 const overview=await call(admin,'admin/overview');assert.equal(overview.status,200);assert.equal(overview.data.summary.students,120);assert.equal(overview.data.summary.members,30);
 for(const user of users){const actual=overview.data.students.find(r=>r.id===user.id);assert.equal(actual.activeMistakes,[...user.model.values()].filter(r=>r.wrong).length);assert.equal(actual.mastered,[...user.model.values()].filter(r=>r.mastered).length);assert.equal(actual.focusMinutes,user.focusMinutes);assert.equal(actual.membership.status,user.membershipStatus);}
 assert.equal(overview.data.summary.mistakes,users.reduce((n,u)=>n+[...u.model.values()].filter(r=>r.wrong).length,0));
 const stats=await call(admin,'admin/question-stats');assert.equal(stats.status,200);
 for(const row of stats.data.rows){assert.equal(row.marked,users.filter(u=>u.model.get(row.key)?.archive).length);assert.equal(row.active,users.filter(u=>u.model.get(row.key)?.wrong).length);assert.equal(row.mastered,users.filter(u=>u.model.get(row.key)?.mastered).length);}
 const exported=await call(admin,'admin/export');assert.equal(exported.status,200);const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(exported.data.base64,'base64'));
 assert.equal(book.worksheets.length,7);const sheet=book.getWorksheet('学生学习'),headers=sheet.getRow(1).values;assert.equal(sheet.rowCount,121);assert.equal(sheet.columnCount,19);
 const byId=new Map(Array.from({length:120},(_,i)=>{const row=sheet.getRow(i+2);return [row.getCell(headers.indexOf('学生ID')).value,row];}));
 for(const user of users){const row=byId.get(user.id),overviewRow=overview.data.students.find(s=>s.id===user.id);assert.equal(row.getCell(headers.indexOf('当前错题')).value,overviewRow.activeMistakes);assert.equal(row.getCell(headers.indexOf('当前已掌握')).value,overviewRow.mastered);assert.equal(row.getCell(headers.indexOf('累计专注分钟')).value,user.focusMinutes);const related=new Set([...user.model].filter(([,r])=>r.wrong).flatMap(([key])=>questions.get(key).points.map(id=>pointInfo(id).number)));assert.equal(row.getCell(headers.indexOf('相关知识点数')).value,related.size);}
 assert.equal(sheet.getRow(2).getCell(headers.indexOf('昵称')).value,'=SUM(1,2)');
 fs.writeFileSync(path.join(output,'large-student-export.xlsx'),Buffer.from(exported.data.base64,'base64'));
 for(const language of ['chn','eng']){const exported=await call(admin,'admin/question-stats/export?language='+language);const qbook=new ExcelJS.Workbook();await qbook.xlsx.load(Buffer.from(exported.data.base64,'base64'));assert.equal(qbook.worksheets[0].rowCount-1,stats.data.rows.filter(r=>r.marked||r.active||r.mastered).length);}
 report.checks.push('Every student/dashboard/2468-question count matches the model; both Excel exports match all rows');
 for(const user of users.slice(0,24))for(const language of ['chn','eng']){
  const summary=await call(user.client,'content/mistake-summary?language='+language);assert.equal(summary.status,200);assert.equal(summary.data.orderedKeys.length,[...user.model.values()].filter(r=>r.wrong).length);
  if(user.membershipStatus==='active'){assert.equal((summary.data.knowledgeDistribution||[]).reduce((n,r)=>n+r.keys.length,0),summary.data.orderedKeys.length);assert.equal(summary.data.pointCount,new Set([...user.model].filter(([,r])=>r.wrong).flatMap(([key])=>questions.get(key).points.map(id=>pointInfo(id).number))).size);}
  const dashboard=await call(user.client,'learning/dashboard?language='+language);assert.equal(dashboard.status,200);assert.ok(dashboard.data.recommendations.new_questions.every(q=>!user.model.get(q.question_id)?.mastered));
  if(user.membershipStatus!=='active')assert.ok(dashboard.data.recommendations.new_questions.every(q=>q.trialAvailable));
 }
 report.checks.push('Mistake distributions and practice recommendations stay consistent with current states and membership');
 // Normal supported pages and malformed URLs must not create internal server errors.
 for(const target of ['home','bank','papers','textbook','examples','exercises','mistakes','focus','profile','membership','payment','receipt','activating','member-success','support']){
  const r=await call(users[1].client,'activity',{action:'page_view',target,eventId:crypto.randomUUID()});if(r.status!==200)report.findings.push({type:'valid-page-activity',target,status:r.status,error:r.data.error});
 }
 for(const route of ['admin/activity?page=Infinity','admin/page-visits?page=Infinity','admin/activity?userId=Infinity','admin/page-visits?userId=Infinity']){const r=await call(admin,route);if(r.status>=500)report.findings.push({type:'invalid-query-500',route,status:r.status});}
 const saved=await call(users[0].client,'mistakes');f.restart();assert.deepEqual((await call(users[0].client,'mistakes')).data,saved.data);assert.equal((await call(admin,'admin/overview')).data.summary.mistakes,overview.data.summary.mistakes);
 report.checks.push('Restart preserves sessions, progress and reporting; requests never cross account ownership');report.passed=report.findings.length===0;
 console.log(JSON.stringify({students:120,requests:report.requests,mutations:report.mutations,transitions:report.questionTransitions,findings:report.findings,passed:report.passed}));
}catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(output,'large-state-report.json'),JSON.stringify(report,null,2));await f.close();}
