import test from 'node:test';
import assert from 'node:assert/strict';
import { profileReview } from '../src/lib/profile-review.js';
const entry=(key,points,source='paper')=>({key,source,network:{links:points.map(sequence=>({sequence}))}});

test('recommendations trace mistakes through exact knowledge links to different textbook exercises',()=>{
  const entries=[entry('wrong1',[1,1,2]),entry('wrong2',['2']),entry('paper-match',[2]),
    entry('tb-101-1',[1],'textbook'),entry('tb-101-2',[2],'textbook'),entry('tb-101-3',[9],'textbook')];
  const r=profileReview(entries,{wrong1:{},wrong2:{},missing:{}},'chn');
  assert.deepEqual(r.questions.map(q=>q.key),['tb-101-2','tb-101-1']);
  assert.deepEqual(r.questions[0].recommendation,{sequences:[2],mistakeKeys:['wrong1','wrong2']});
  assert.deepEqual(r.points,[[2,2],[1,1]]);
  assert.equal(r.mistakeCount,2);
  assert.equal(r.candidateCount,2);
});
test('a saved textbook mistake contributes knowledge but is not its own recommendation',()=>{
  const entries=[entry('tb-101-1',[3],'textbook'),entry('tb-101-2',[3],'textbook')];
  const r=profileReview(entries,{'tb-101-1':{}},'eng');
  assert.deepEqual(r.questions.map(q=>q.key),['tb-101-2']);
  assert.deepEqual(r.questions[0].recommendation.mistakeKeys,['tb-101-1']);
});
test('duplicate entries and links cannot inflate priority; more distinct mistakes rank first',()=>{
  const a=entry('a',[1,2]),b=entry('b',[3]);
  const entries=[a,a,b,entry('tb-101-1',[1,1,2],'textbook'),entry('tb-101-2',[1,3],'textbook'),entry('tb-101-2',[1,3],'textbook')];
  const r=profileReview(entries,{a:{},b:{}},'chn');
  assert.equal(r.questions[0].key,'tb-101-2');
  assert.equal(r.candidateCount,2);
  assert.equal(r.mistakeCount,2);
  assert.deepEqual(r.points,[[1,1],[2,1],[3,1]]);
});
test('next set advances through ranked matches and wraps without repeating within a set',()=>{
  const entries=[entry('wrong',[1]),...Array.from({length:7},(_,i)=>entry(`tb-101-${i+1}`,[1],'textbook'))];
  const batches=[0,1,2,3].map(n=>profileReview(entries,{wrong:{}},'chn',n).questions.map(q=>q.key));
  assert.deepEqual(batches[0],['tb-101-1','tb-101-2','tb-101-3']);
  assert.deepEqual(batches[1],['tb-101-4','tb-101-5','tb-101-6']);
  assert.deepEqual(batches[2],['tb-101-7']);
  assert.deepEqual(batches[3],batches[0]);
});
test('empty and unlinked mistakes never fall back to random or unrelated questions',()=>{
  const entries=[entry('wrong',[]),entry('linked',[1]),entry('tb-101-1',[9],'textbook')];
  for(const mistakes of [{},{missing:{}},{wrong:{}},{linked:{}}]){
    const r=profileReview(entries,mistakes,'chn');
    assert.deepEqual(r.questions,[]);assert.deepEqual(r.points,[]);
  }
  assert.equal(profileReview(entries,{linked:{}},'chn').linkedPointCount,1);
});
test('missing and invalid links are ignored',()=>{
  const r=profileReview([{key:'missing'},entry('wrong',[null,undefined,'bad',0,-1,1.5]),entry('tb-101-1',[1],'textbook')],{missing:{},wrong:{}},'eng');
  assert.equal(r.linkedPointCount,0);assert.deepEqual(r.questions,[]);
});
