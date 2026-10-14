import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createTopicPractice} from '../server/topic-practice.mjs';
import {createQdnaLearning,studentLearningView} from '../server/qdna-learning.mjs';
import {questions,points,pointInfo} from '../server/catalog.mjs';
import {isTrialPractice} from '../server/recommendation-access.mjs';

const topic=id=>({knowledge_id:String(id),number:id==='2'?'1':String(id),name:'Topic '+(id==='2'?'1':id),chapter:'Chapter'});
const exercise=(id,ids)=>[id,{source:'textbook',exerciseChapter:'101',points:ids,label:id,labelEn:id}];
const base=new Map([
 ['wrong-a',{points:[1,2]}],['wrong-b',{points:[3]}],['wrong-c',{points:[4]}],['wrong-d',{points:[5]}],['wrong-e',{points:[6]}],
 ...Array.from({length:6},(_,i)=>exercise('tb-101-'+(i+1),[i<4?1:2])),
 ['past',{points:[1]}],['ex-101-1',{source:'examples',points:[1]}],exercise('tb-102-1',[3]),exercise('tb-103-1',[4])
]);
const make=(catalog=base,options={})=>createTopicPractice({catalog,knowledgeIds:[1,2,3,4,5,6],knowledgeInfo:topic,...options});
const wrong=(...ids)=>new Map(ids.map(id=>[id,{status:'WRONG'}]));
test('all current mistake cards are included without minimum confidence or a top-three truncation',()=>{
 const states=wrong('wrong-a','wrong-b','wrong-c','wrong-d','wrong-e');
 const result=make()({states,dna:new Map()});
 assert.equal(result.length,5);assert.deepEqual(result.map(p=>p.number),['1','3','4','5','6']);
 assert.equal(result[0].wrong_question_count,1,'merged source identities count the same mistake once');
 assert.ok(result.every(p=>p.practice.items.every(q=>q.question_id.startsWith('tb-'))));
 assert.deepEqual(result[0].practice.items.map(q=>q.question_id),['tb-101-1','tb-101-2','tb-101-3']);
 assert.equal(result.at(-1).practice.items.length,0,'missing mappings are not filled with unrelated questions');
 assert.deepEqual(make()({states,dna:new Map()}),result,'repeat calls use a stable textbook order');
});
test('mastered exercises are excluded before each topic limit and the next matching practice replaces them',()=>{
 const states=wrong('wrong-a');states.set('tb-101-1',{status:'MASTERED'});states.set('tb-101-2',{status:'WRONG'});
 const result=make()({states,dna:new Map()});
 assert.deepEqual(result[0].practice.items.map(q=>q.question_id),['tb-101-2','tb-101-3','tb-101-4']);
 for(let i=1;i<=6;i++)states.set('tb-101-'+i,{status:'MASTERED'});
 assert.deepEqual(make()({states,dna:new Map()})[0].practice.items,[]);
 states.set('wrong-a',{status:'MASTERED'});assert.deepEqual(make()({states,dna:new Map()}),[]);
});
test('targeted exercise selection is displayed in textbook order instead of score order',()=>{
 const catalog=new Map([['wrong',{points:[1]}],...[[1,[1,3]],[2,[1]],[3,[1,4]],[4,[1]]].map(([n,ids])=>exercise('tb-101-'+n,ids))]);
 const result=make(catalog)({states:wrong('wrong'),dna:new Map()});
 assert.deepEqual(result[0].practice.items.map(q=>q.question_id),['tb-101-1','tb-101-2','tb-101-4']);
});
test('weakness ordering uses the current marks, includes low-confidence mistakes, and does not rank mastered-only topics',()=>{
 const states=wrong('wrong-a','wrong-b','wrong-c','wrong-d');states.set('tb-101-1',{status:'MASTERED'});
 const result=make()({states,dna:new Map()});assert.deepEqual(result.map(p=>p.number),['3','4','5','1']);
 states.set('wrong-b',{status:'MASTERED'});assert.deepEqual(make()({states,dna:new Map()}).map(p=>p.number),['4','5','1']);
 assert.deepEqual(make()({states:new Map(),dna:new Map()}),[]);
});
test('existing topic links and DNA are both retained and exercise suggestions use reviewed direct links only',()=>{
 const dna=new Map([['wrong-a',[{knowledge_id:'4',weight:.4}]]]);
 const result=make()({states:wrong('wrong-a'),dna});assert.deepEqual(new Set(result.map(p=>p.number)),new Set(['1','4']));
 assert.deepEqual(result.find(p=>p.number==='4').practice.items.map(q=>q.question_id),['tb-103-1']);
 assert.equal(result.some(p=>p.practice.items.some(q=>q.question_id==='past'||q.question_id.startsWith('ex-'))),false);
});
test('free scope preserves all weak topics but filters matching exercises before selection and hides paid identifiers',()=>{
 const free=make(base,{isFreeTopic:id=>['1','2'].includes(id),isFreeQuestion:id=>['tb-101-4','tb-101-5','tb-101-6'].includes(id)});
 const result=free({states:wrong('wrong-a','wrong-b'),dna:new Map(),trialOnly:true});
 assert.equal(result.length,2);assert.deepEqual(result[0].practice.items.map(q=>q.question_id),['tb-101-4','tb-101-5','tb-101-6']);
 assert.equal(result[1].practice.locked,true);assert.deepEqual(result[1].practice.items,[]);
 assert.doesNotMatch(JSON.stringify(result),/tb-102-1/);
});
test('real knowledge cards exceed one analysis page without disappearing; student responses keep private scores hidden',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE protected_dna(language TEXT,id TEXT,body TEXT)');
 const states=wrong(...[...questions.values()].filter(q=>q.source==='examples').map(q=>q.key));
 const service=createQdnaLearning({db,clock:()=>123,statusStore:{snapshot:()=>states}});
 try {
  const full=service.dashboard(1,{limit:1}),member=studentLearningView(full,{recommendationAccess:true});
  assert.ok(member.weak_points.length>20);assert.equal(full.signals.rows.length,1);
  const expected=new Set([...states.keys()].flatMap(id=>questions.get(id).points.map(p=>pointInfo(p).number)));
  assert.deepEqual(new Set(member.weak_points.map(p=>p.number)),expected);assert.equal(member.weak_points.length,expected.size);
  for(const p of member.weak_points)for(const q of p.practice.items){assert.equal(questions.get(q.question_id).source,'textbook');assert.ok(questions.get(q.question_id).points.some(id=>pointInfo(id).number===p.number));}
  assert.doesNotMatch(JSON.stringify(member),/wrong_question_count|weakness|wrongWeight|markedWeight|knowledge_weights|recommendation_score/);
  const free=studentLearningView(full,{recommendationAccess:false});assert.equal(free.weak_points.length,member.weak_points.length);
  assert.ok(free.weak_points.flatMap(p=>p.practice.items).every(q=>q.trialAvailable&&isTrialPractice(q.question_id)));
  const empty=createQdnaLearning({db,clock:()=>123,statusStore:{snapshot:()=>new Map()}}).dashboard(2);
  assert.deepEqual(studentLearningView(empty).weak_points,[]);
  const picked=member.weak_points.flatMap(p=>p.practice.items)[0];states.set(picked.question_id,{status:'MASTERED'});
  assert.ok(studentLearningView(service.dashboard(1),{recommendationAccess:true}).weak_points.every(p=>p.practice.items.every(q=>q.question_id!==picked.question_id)));
 } finally{db.close();}
});
