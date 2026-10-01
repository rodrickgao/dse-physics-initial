import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadingFocus, visibleReadingTarget} from '../src/lib/reading-focus.js';

function harness(){
  const records={};let serial=0;
  const tracker=createReadingFocus({save:(id,ms)=>records[id]=ms,makeId:()=>`visit-${++serial}`});
  const run=(target,start,end)=>{for(let t=start;t<=end;t+=1000)tracker.update(target,t);};
  return {tracker,records,run};
}
test('a visit must exceed 60 seconds, then includes its first minute without duplicate totals',()=>{
  const {tracker,records,run}=harness();
  run('q1',0,60000);assert.deepEqual(records,{});
  tracker.update('q1',61000);assert.deepEqual(records,{'visit-1':61000});
  tracker.update('q1',62000);assert.deepEqual(records,{'visit-1':62000});
  tracker.update(null,62500);assert.deepEqual(records,{'visit-1':62500});
  tracker.update(null,200000);assert.deepEqual(records,{'visit-1':62500});
});
test('short visits to different questions or returning after background do not combine',()=>{
  const {tracker,records,run}=harness();
  run('q1',0,30000);run('q2',31000,60000);run('q1',61000,90000);
  tracker.update(null,91000);run('q1',120000,150000);
  assert.deepEqual(records,{});
});
test('background, manual timer and leaving the content pause automatic accounting',()=>{
  const {tracker,records,run}=harness();
  run('knowledge:1',0,70000);tracker.update(null,71000);
  run(null,72000,180000);assert.equal(Object.values(records).reduce((a,b)=>a+b,0),71000);
  run('knowledge:1',181000,242000);assert.deepEqual(records,{'visit-1':71000,'visit-2':61000});
});
test('sleep gaps and system clock jumps cannot inflate focus time',()=>{
  const {tracker,records,run}=harness();
  run('q1',0,61000);tracker.update('q1',3600000);
  assert.deepEqual(records,{'visit-1':61000});
  tracker.update('q1',-1000);assert.deepEqual(records,{'visit-1':61000});
});
test('only one visible knowledge card is selected and offscreen content is ignored',()=>{
  const element=(id,top,bottom)=>({getAttribute:()=>id,getBoundingClientRect:()=>({top,bottom,left:0,right:300,width:300,height:bottom-top})});
  assert.equal(visibleReadingTarget([element('a',-700,-10),element('b',10,500),element('c',510,1400)],320,800),'b');
  assert.equal(visibleReadingTarget([element('a',-700,-10),element('b',810,1500)],320,800),null);
  assert.equal(visibleReadingTarget([element('tall',-1000,2000)],320,800),'tall');
});
