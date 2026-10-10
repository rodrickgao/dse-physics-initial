import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {calculateKnowledgeWeakness,weaknessConfiguration} from '../server/knowledge-weakness.mjs';
import {getRecommendedQuestions} from '../server/qdna-recommendations.mjs';
import {createApi} from '../server/api.mjs';
import {weeklyReportEmail} from '../server/weekly-report-email.mjs';
import {createQdnaLearning} from '../server/qdna-learning.mjs';

const knowledge=new Map([['16',{}],['17',{}]]);
const weights=(weight=1,id='16')=>[{knowledge_id:id,weight}];
const state=(...statuses)=>new Map(statuses.map((status,i)=>['q'+i,{status}]));
test('QDNA zero, one and two distinct marks stay insufficient without a displayed 50% prior',()=>{
 const dna=new Map([['q0',weights()],['q1',weights(.6)],['q2',weights(.4)]]);
 for(const statuses of [[],['WRONG'],['WRONG','MASTERED']]){
  const r=calculateKnowledgeWeakness(state(...statuses),dna,knowledge).rows[0];
  assert.equal(r.marked_question_count,statuses.length);assert.equal(r.weakness_signal,null);assert.equal(r.status,'INSUFFICIENT_DATA');
 }
 const zero=calculateKnowledgeWeakness(new Map(),dna,knowledge).rows[0];assert.equal(zero.raw_weakness,null);
 const one=calculateKnowledgeWeakness(state('WRONG'),dna,knowledge).rows[0];assert.equal(one.wrong_weight,1);assert.equal(one.mastered_weight,0);
});
test('weighted calculation retracts old states, ignores unmarked/missing DNA, and follows configured thresholds',()=>{
 const dna=new Map([['q0',weights(1)],['q1',weights(.6)],['q2',weights(.4)]]);
 let states=state('WRONG','WRONG','MASTERED','WRONG');
 let result=calculateKnowledgeWeakness(states,dna,knowledge),r=result.rows[0];
 assert.equal(result.missing_dna_count,1);assert.equal(r.marked_question_count,3);assert.equal(r.wrong_question_count,2);assert.equal(r.mastered_question_count,1);assert.equal(r.total_marked_weight,2);assert.ok(Math.abs(r.weakness_signal-.7)<1e-12);assert.equal(r.status,'NEEDS_REVIEW');
 states.set('q0',{status:'MASTERED'});r=calculateKnowledgeWeakness(states,dna,knowledge).rows[0];assert.equal(r.wrong_weight,.6);assert.equal(r.mastered_weight,1.4);assert.equal(r.status,'DEVELOPING');
 states.set('q1',{status:'MASTERED'});r=calculateKnowledgeWeakness(states,dna,knowledge).rows[0];assert.equal(r.weakness_signal,1/6);assert.equal(r.status,'STRONG');
 states.set('q0',{status:'UNMARKED'});r=calculateKnowledgeWeakness(states,dna,knowledge).rows[0];assert.equal(r.marked_question_count,2);assert.equal(r.weakness_signal,null);
 const cfg=weaknessConfiguration({DSE_QDNA_MIN_MARKED:2,DSE_QDNA_ALPHA:0,DSE_QDNA_BETA:1});assert.equal(calculateKnowledgeWeakness(states,dna,knowledge,cfg).rows[0].weakness_signal,0);
 assert.throws(()=>weaknessConfiguration({DSE_QDNA_ALPHA:2,DSE_QDNA_BETA:1}));
});
test('classification boundaries are exactly 0.3 and 0.6, independently of UI rounding',()=>{
 const cfg={...weaknessConfiguration(),alpha:0,beta:1,minimum:1};
 const dna=new Map([['q0',weights(.6)],['q1',weights(.4)]]);
 const r=calculateKnowledgeWeakness(state('WRONG','MASTERED'),dna,knowledge,cfg).rows[0];assert.equal(r.weakness_signal,.3);assert.equal(r.status,'DEVELOPING');
 const r2=calculateKnowledgeWeakness(state('WRONG'),new Map([['q0',weights(1)]]),knowledge,{...cfg,alpha:.2}).rows[0];assert.equal(r2.weakness_signal,.6);assert.equal(r2.status,'NEEDS_REVIEW');
});
test('ranking uses sufficient signals only, excludes mastered, splits wrongs, and resolves ties by ID',()=>{
 const dna=new Map([['a',weights(1)],['b',weights(1)],['c',weights(.6)],['d',weights(1)],['e',weights(1)],['f',weights(1,'17')]]);
 const catalog=new Map([...dna.keys()].map(id=>[id,{label:id,labelEn:id}]));
 const opts={dna,catalog,states:new Map([['d',{status:'MASTERED'}],['e',{status:'WRONG'}]]),signals:{rows:[{knowledge_id:'16',sufficient_data:true,adjusted_weakness:.75,status:'NEEDS_REVIEW'},{knowledge_id:'17',sufficient_data:false,adjusted_weakness:null}]},knowledgeInfo:id=>({knowledge_id:id,name:'Topic '+id,chapter:'Chapter'}),limit:8};
 const actual=getRecommendedQuestions(opts);assert.deepEqual(actual.new_questions.map(q=>q.question_id),['a','b','c']);assert.deepEqual(actual.wrong_review.map(q=>q.question_id),['e']);assert.equal(actual.new_questions[0].recommendation_score,.75);assert.equal(actual.new_questions[2].recommendation_score,.45);
 assert.deepEqual(getRecommendedQuestions(opts),actual);assert.ok(actual.new_questions.every(q=>q.recommendation_reason&&q.question_url));
 assert.equal(getRecommendedQuestions({...opts,signals:{rows:[]}}).personalized,true);
});
test('recommendation score sums relevant weights and diversity does not disturb stable returned ordering',()=>{
 const dna=new Map(Array.from({length:12},(_,i)=>['q'+String(i).padStart(2,'0'),weights(i<10?1:.8,i<10?'16':'17')]));dna.set('both',[...weights(1),...weights(1,'17')]);
 const signals={rows:['16','17'].map(id=>({knowledge_id:id,sufficient_data:true,adjusted_weakness:.7,status:'NEEDS_REVIEW'}))};
 const result=getRecommendedQuestions({states:new Map(),dna,signals,catalog:new Map([...dna.keys()].map(id=>[id,{label:id}])),knowledgeInfo:id=>({knowledge_id:id,name:id}),limit:8});
 assert.equal(result.new_questions.length,5);
 for(const id of ['16','17'])assert.ok(result.new_questions.filter(q=>q.primary_knowledge.knowledge_id===id).length<=3);assert.equal(result.new_questions[0].question_id,'both');assert.equal(result.new_questions[0].recommendation_score,1.4);assert.ok(result.new_questions.some(r=>r.primary_knowledge.knowledge_id==='17'));
 assert.ok(result.new_questions.every((r,i,a)=>!i||a[i-1].recommendation_score>=r.recommendation_score));
});

test('API status transitions, history, own-user isolation, admin counts, bounded QDNA and weekly consistency',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'dse-qdna-'));let now=Date.now();
 const q=i=>`2012|paper-1a|${i}`,dnaDirectory=join(directory,'dna'),files=[];
 const records=Array.from({length:16},(_,i)=>({question_id:q(i+1),knowledge_weights:weights(i===3?.6:1).map(w=>({...w,evidence:'Private evidence never returned to students'})),reasoning_steps:['Private annotation'],issues:[]}));
 for(const lang of ['中文版','英文版']){const folder=join(dnaDirectory,lang,'json');mkdirSync(folder,{recursive:true});const file=join(folder,'QDNA.json');writeFileSync(file,JSON.stringify(records));files.push([file,readFileSync(file,'utf8')]);}
 let api=createApi({directory,adminKey:'qdna-local-test',clock:()=>now,qdnaDirectory:dnaDirectory,contentLimits:{similar:1000}});
 const server=createServer((req,res)=>api.handler(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/`;
 const client=()=>{let cookie='';return async(path,body,method='POST')=>{const r=await fetch(base+path,{headers:{cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{method,body:JSON.stringify(body)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,headers:r.headers,...await r.json()};};};
 const a=client(),b=client(),admin=client(),guest=client();
 const login=async(c,email)=>{const sent=await c('auth/code',{email});const r=await c('auth/verify',{email,code:sent.developmentCode});assert.equal(r.status,200);const profile=await c('profile',{nickname:'QDNA 测试',grade:'中五',target:'5',avatar:'newton-wave',password:'Study-pass-123',confirmPassword:'Study-pass-123'},'PUT');assert.equal(profile.status,200);return r.user.id;};
 let studentId;
 const dash=async()=>{const r=await admin(`admin/learning/dashboard?studentId=${studentId}`);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');return r;};
 const signal=r=>r.signals.rows.find(k=>k.knowledge_id==='16');
 const mark=async(i,status)=>{now+=1000;const r=await a('progress',{keys:[q(i)],status},'PUT');assert.equal(r.status,200);return r;};
 try{
  const id=await login(a,'qdna-a@test.example');studentId=id;await login(b,'qdna-b@test.example');await admin('admin/login',{key:'qdna-local-test'});
  assert.equal((await guest('learning/dashboard')).status,401);assert.equal((await a('admin/learning/overview')).status,403);
  let r=await dash();const version=r.qdna_version;assert.equal(r.counts.marked,0);assert.equal(r.recommendations.personalized,false);assert.ok(r.signals.rows.every(k=>k.weakness_signal===null));
  await mark(1,'mistake');r=await dash();assert.equal(signal(r).wrong_question_count,1);assert.equal(signal(r).weakness_signal,null);assert.equal(r.recommendations.personalized,true);assert.ok(r.recommendations.new_questions.length);assert.equal((await a('learning/dashboard')).weak_points[0].knowledge_id,'16');
  const checkLocked=async()=>{for(const language of ['chn','eng']){const guidance=await a(`learning/dashboard?language=${language}`);assert.equal(guidance.status,200);assert.ok(guidance.weak_points.length,'Free users retain review topics');assert.deepEqual(guidance.recommendations,{locked:true});const detail=await a(`learning/knowledge?id=16&language=${language}`);assert.equal(detail.status,200);assert.ok(detail.knowledge);assert.deepEqual(detail.recommendations,{locked:true});assert.equal((await a(`content/recommendations?language=${language}`)).status,403);const weekly=api.buildWeeklyReport(id,{language});assert.deepEqual(weekly.recommended_questions,[]);assert.equal(weekly.recommendations_locked,true);assert.equal(weekly.personalized,false);}};
  await checkLocked();
  assert.equal((await admin('admin/membership',{userId:id,action:'extend',days:1,reason:'Recommendation membership fixture',revision:0,requestId:crypto.randomUUID()})).status,200);
  for(const language of ['chn','eng']){const paid=await a(`learning/dashboard?language=${language}`);assert.ok(paid.recommendations.new_questions.length);assert.equal(paid.recommendations.locked,undefined);assert.equal((await a(`content/recommendations?language=${language}`)).status,200);}
  await mark(1,'mistake');r=await dash();assert.equal(signal(r).wrong_question_count,1);
  await mark(1,'mastered');r=await dash();assert.equal(signal(r).wrong_weight,0);assert.equal(signal(r).mastered_weight,1);
  await mark(1,'mistake');r=await dash();assert.equal(signal(r).wrong_weight,1);assert.equal(signal(r).mastered_weight,0);
  await mark(1,'clear');r=await dash();assert.equal(signal(r)?.marked_question_count||0,0);assert.equal(r.counts.marked,0);
  await a('mistakes',{key:q(1),marked:true},'PUT');await a('mistakes',{key:q(1),marked:false},'PUT');
  await a('mistakes/trash',{action:'restore',keys:[q(1)]});await mark(1,'mastered');
  await a('mistakes/trash',{action:'restore',keys:[q(1)]});r=await dash();assert.equal(r.counts.mastered,0);assert.equal(r.counts.wrong,1);
  const changed=await mark(1,'mastered');await a('progress/undo',{id:changed.undoId});r=await dash();assert.equal(r.counts.wrong,1);assert.equal(r.counts.mastered,0);
  await mark(2,'mistake');await mark(3,'mistake');r=await dash();assert.equal(signal(r).weakness_signal,.875);assert.equal(r.recommendations.new_questions.length,3);assert.equal(r.recommendations.wrong_review.length,3);
  assert.deepEqual((await b('learning/dashboard')).weak_points,[]);
  assert.deepEqual((await b('learning/dashboard')).recommendations,{locked:true},'Another free user cannot inherit member recommendations');
  const guidance=await a('learning/dashboard');assert.equal(guidance.weak_points[0].knowledge_id,'16');assert.equal(guidance.recommendations.new_questions.length,3);
  assert.doesNotMatch(JSON.stringify(guidance),/recommendation_score|weakness_signal|qdna_version|missing_dna|marked_question_count|wrong_weight|counts|signals/);
  const studentDetail=await a('learning/knowledge?id=16');assert.ok(studentDetail.knowledge);assert.equal(studentDetail.rows,undefined);assert.equal(studentDetail.signal,undefined);assert.doesNotMatch(JSON.stringify(studentDetail),/recommendation_score|weight/);

  for(const suffix of [`studentId=${id+1}`,'limit=51','offset=-1','ids=1,2','limit=1&limit=2','language=bad','userId=1'])assert.equal((await a('learning/dashboard?'+suffix)).status,400,suffix);
  const detail=await admin(`admin/learning/knowledge?studentId=${id}&id=16&status=WRONG&limit=2`);assert.equal(detail.rows.length,2);assert.equal(detail.total,3);assert.equal(detail.rows[0].weight,1);assert.deepEqual(detail.counts,{MASTERED:0,WRONG:3,UNMARKED:13});
  assert.doesNotMatch(JSON.stringify(detail),/Private evidence|knowledge_weights|reasoning_steps/);
  assert.equal((await a('learning/knowledge?id=999999')).status,404);assert.equal((await a('learning/knowledge?id=16&status=INVALID')).status,400);
  const other=await b('progress',{keys:[q(1)],status:'mastered'},'PUT');assert.equal(other.status,200);
  let stats=await admin('admin/learning/overview?type=questions&limit=2');const qr=stats.rows.find(row=>row.question_id===q(1));assert.equal(qr.wrong_students,1);assert.equal(qr.mastered_students,1);assert.equal(qr.marked_students,2);assert.deepEqual(qr.qdna,weights());
  const ks=await admin('admin/learning/overview?type=knowledge');assert.equal(ks.rows[0].knowledge_id,'16');assert.equal(ks.rows[0].needs_review_students,1);assert.equal(ks.rows[0].question_count,16);
  await a('progress',{keys:['tb-101-1'],status:'mastered'},'PUT');r=await dash();assert.equal(r.signals.missing_dna_count,1);assert.equal(r.counts.marked,4);assert.equal(signal(r).marked_question_count,3);
  await mark(4,'mastered');r=await dash();assert.ok(!r.recommendations.new_questions.some(qr=>qr.question_id===q(4)));
  now+=1000;const weekly=await admin(`admin/learning/weekly?studentId=${id}`);assert.equal(weekly.status,200);assert.equal(weekly.report.qdna_version,r.qdna_version);assert.deepEqual(weekly.report.recommended_questions,r.recommendations.new_questions.slice(0,3));assert.deepEqual(weekly.report.focus_areas,r.highlights.NEEDS_REVIEW);
  assert.equal(weekly.report.activity.newly_wrong,3);assert.equal(weekly.report.activity.newly_mastered,3);assert.equal(weekly.report.partial_history,true);assert.match(weekly.email.text,/本周新增已掌握：3/);assert.doesNotMatch(weekly.email.text,/专注|正确率/);
  const emptyWeek=await admin(`admin/learning/weekly?studentId=${id}&start=${now-1}&end=${now}`);assert.deepEqual(emptyWeek.report.activity,{newly_mastered:0,newly_wrong:0});assert.equal(emptyWeek.report.partial_history,false);
  const ad=await admin(`admin/learning/dashboard?studentId=${id}`);assert.deepEqual(ad.recommendations,r.recommendations);const oldAdmin=await admin(`admin/student?id=${id}`);assert.deepEqual(oldAdmin.analytics.recommendations,r.recommendations);
  const en=await admin(`admin/learning/dashboard?studentId=${id}&language=eng`);assert.equal(en.qdna_version,version);assert.equal(signal(en).weakness_signal,signal(r).weakness_signal);assert.match(en.recommendations.new_questions[0].recommendation_reason,/Practise/);
  // Rollbacks must not leave either partial status writes or history events.
  const before=await dash();assert.equal((await a('progress',{keys:[q(2),'invalid'],status:'clear'},'PUT')).status,400);assert.deepEqual((await dash()).counts,before.counts);
  const inspector=new DatabaseSync(join(directory,'students.sqlite'),{readOnly:true});
  const events=inspector.prepare('SELECT * FROM question_status_events WHERE user_id=? ORDER BY id').all(id);assert.ok(events.every(e=>e.from_status!==e.to_status));assert.equal(events.filter(e=>e.question_id===q(1)&&e.to_status==='WRONG').length,6);inspector.close();
  for(const [file,body] of files)assert.equal(readFileSync(file,'utf8'),body,'source QDNA must not be rewritten');
  assert.equal((await admin('admin/membership',{userId:id,action:'revoke',reason:'Fixture revoke',revision:1,requestId:crypto.randomUUID()})).status,200);await checkLocked();
  assert.equal((await admin('admin/membership',{userId:id,action:'extend',days:1,reason:'Fixture renewal',revision:2,requestId:crypto.randomUUID()})).status,200);assert.ok((await a('learning/dashboard')).recommendations.new_questions.length);
  now+=86400001;await checkLocked();await admin('admin/login',{key:'qdna-local-test'});assert.ok((await dash()).recommendations.new_questions.length,'Admin retains analysis after student expiry');
  api.close();api=createApi({directory,adminKey:'qdna-local-test',clock:()=>now,qdnaDirectory:dnaDirectory,contentLimits:{similar:1000}});assert.equal((await dash()).qdna_version,version);assert.deepEqual((await dash()).counts,before.counts);
 }finally{await new Promise(r=>server.close(r));api.close();rmSync(directory,{recursive:true});}
});

test('weekly renderer escapes names and keeps cold-start honest in both languages without sending mail',async()=>{
 for(const language of ['chn','eng']){const message=await weeklyReportEmail({from:'test@local.invalid',to:'test@local.invalid',report:{kind:'qdna-weekly',language,name:'<script>bad()</script>',start:1000000000,end:1000600000,partial_history:false,activity:{newly_mastered:0,newly_wrong:0},focus_areas:[],recommended_questions:[],personalized:false,continue_url:'/#home'}});assert.doesNotMatch(message.html,/<script>/);assert.match(message.html,/&lt;script&gt;/);assert.doesNotMatch(message.text,/50%/);assert.match(message.html,/https:\/\/ddphysics.com\/#mistakes/);assert.equal(message.attachments.length,1);}
});

test('QDNA startup index adapts existing weights, deduplicates IDs, uses language fallback, and versions reloads',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE protected_dna(language TEXT,id TEXT,body TEXT)');
 const insert=db.prepare('INSERT INTO protected_dna VALUES(?,?,?)'),q='2012|paper-1a|1';
 insert.run('chn',q,JSON.stringify({knowledge_weights:[...weights(.3),...weights(.8),...weights(1,'999999')]}));
 insert.run('eng',q,JSON.stringify({knowledge_weights:weights(.8)}));
 insert.run('eng','2012|paper-1a|2',JSON.stringify({knowledge_weights:weights(.4)}));
 const statusStore={snapshot:()=>new Map([[q,{status:'WRONG'}]])},create=()=>createQdnaLearning({db,clock:()=>123,statusStore});
 try{const service=create(),old=service.snapshot(1);assert.equal(old.signals.rows.find(r=>r.knowledge_id==='16').wrong_weight,.3);assert.equal(old.signals.rows.find(r=>r.knowledge_id==='16').marked_question_count,1);assert.equal(service.knowledge(1,'016').total,2);
 const english=createQdnaLearning({db,clock:()=>123,statusStore,canonicalLanguage:'eng'});assert.equal(english.snapshot(1).signals.rows.find(r=>r.knowledge_id==='16').wrong_weight,.8);assert.notEqual(english.version,service.version);
 db.prepare('UPDATE protected_dna SET body=? WHERE language=? AND id=?').run(JSON.stringify({knowledge_weights:weights(.6)}),'chn',q);
 assert.deepEqual(service.snapshot(1),old,'requests use the already parsed private index');const reloaded=create();assert.notEqual(reloaded.version,service.version);assert.equal(reloaded.snapshot(1).signals.rows.find(r=>r.knowledge_id==='16').wrong_weight,.6);
 }finally{db.close();}
});

test('learning API rate limits are temporary, per account and applied to detail as well as recommendations',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'dse-qdna-limit-'));let now=Date.now();const api=createApi({directory,clock:()=>now,adminKey:'limit-fixture',contentLimits:{similar:2}});
 const server=createServer((req,res)=>api.handler(req,res,()=>{res.writeHead(404);res.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/`;
 const login=async email=>{const code=await (await fetch(base+'auth/code',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})})).json();const res=await fetch(base+'auth/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,code:code.developmentCode})});return res.headers.get('set-cookie').split(';')[0];};
 try{const a=await login('qdna-limit-a@test.example'),b=await login('qdna-limit-b@test.example');const get=(cookie,path='learning/dashboard')=>fetch(base+path,{headers:{cookie}});
 assert.equal((await get(a)).status,200);assert.equal((await get(a,'learning/knowledge?id=16')).status,200);const limited=await get(a);assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);assert.equal((await get(b)).status,200);now+=61000;assert.equal((await get(a)).status,200);
 }finally{await new Promise(r=>server.close(r));api.close();rmSync(directory,{recursive:true});}
});

test('one mistake without DNA uses existing knowledge links immediately and excludes mastered questions',()=>{
 const catalog=new Map([['wrong',{label:'Wrong',points:[16]}],['practice',{label:'Practice',points:[16]}],['mastered',{label:'Mastered',points:[16]}],['unrelated',{label:'Other',points:[17]}]]);
 const states=new Map([['wrong',{status:'WRONG'}],['mastered',{status:'MASTERED'}]]);
 const opts={states,dna:new Map(),signals:{rows:[]},catalog,knowledgeInfo:id=>({knowledge_id:id,name:'Topic '+id})};
 const result=getRecommendedQuestions(opts);assert.equal(result.personalized,true);assert.deepEqual(result.new_questions.map(q=>q.question_id),['practice']);assert.deepEqual(result.wrong_review.map(q=>q.question_id),['wrong']);
 states.delete('wrong');assert.equal(getRecommendedQuestions(opts).personalized,false);
});
