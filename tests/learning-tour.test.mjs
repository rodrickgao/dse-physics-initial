import test from 'node:test';
import assert from 'node:assert/strict';
import {freshTour,readTour,saveTour,tourKey,completeTourStep} from '../src/lib/tour-state.js';
import {coreSteps,pageTours,CORE_STEP_COUNT} from '../src/lib/tour-steps.js';
test('tutorial progress is versioned, account-scoped and tolerates unavailable or corrupt storage',()=>{
 const rows=new Map(),storage={getItem:k=>rows.get(k),setItem:(k,v)=>rows.set(k,v)};
 const state=completeTourStep(freshTour(),2);assert.equal(saveTour(storage,'a',state),true);
 assert.equal(readTour(storage,'a').lastCompleted,2);assert.equal(readTour(storage,'b').status,'not-started');
 rows.set(tourKey('a'),'{');assert.deepEqual(readTour(storage,'a'),freshTour());
 rows.set(tourKey('a'),JSON.stringify({...state,version:0}));assert.deepEqual(readTour(storage,'a'),freshTour());
 assert.equal(saveTour(null,'a',state),false);assert.deepEqual(readTour(null,'a'),freshTour());
});
test('core completion is monotonic and major pages have bilingual guides',()=>{
 let state=completeTourStep(freshTour(),3);state=completeTourStep(state,1);assert.equal(state.lastCompleted,3);
 assert.equal(completeTourStep(state,CORE_STEP_COUNT-1).status,'completed');
 assert.equal(completeTourStep({...state,skippedSteps:[2]},CORE_STEP_COUNT-1).status,'skipped');
 assert.deepEqual(completeTourStep({...state,skippedSteps:[2]},2).skippedSteps,[]);
 assert.equal(coreSteps.length,10);assert.equal(new Set(coreSteps.map(s=>s.id)).size,10);
 for(const s of coreSteps){assert.ok(s.title.chn&&s.title.eng&&s.permission);if(s.mode==='action')assert.ok(s.complete.includes('data-'));}
 for(const p of ['home','bank','papers','examples','exercises','textbook','mistakes','membership','ask','focus','profile'])assert.ok(pageTours[p]?.length);
});

test('v1 completion and skip preferences survive the new flow without forcing a popup',()=>{
 for(const status of ['completed','skipped']) {
  const storage={getItem:key=>key.startsWith('ddphysics-tour:v1:')?JSON.stringify({version:1,status,lastCompleted:6}):null};
  const result=readTour(storage,'a');assert.equal(result.version,4);assert.equal(result.status,status);assert.equal(result.lastCompleted,-1);
 }
 assert.ok(coreSteps.find(s=>s.id==='mark').complete.includes('aria-pressed="true"'));
 assert.deepEqual(coreSteps.find(s=>s.id==='mistake-review').route,['mistakes']);
});
