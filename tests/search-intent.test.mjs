import test from 'node:test';
import assert from 'node:assert/strict';
import {indexQuestion,rankQuestionEntries,searchIntent} from '../src/lib/question-search.js';
const make=(key,text,extra={})=>indexQuestion({key,source:'examples',year:{year:0},paper:{title:''},question:{label:''},network:{keywords:''},...extra},text);
const index=[make('ex-202-4','Finding acceleration from a v–t graph. An MTR train travels along a straight track.'),make('ex-206-1','Two trolleys collide. Apply conservation of momentum.'),make('ex-402-1','Two lamps are connected in parallel. Compare their brightness.'),make('ex-104-1','Calculate the specific heat capacity of water.'),make('2025|paper-1a|1','A velocity-time graph. Find acceleration.',{source:'past-paper',year:{year:2025},paperIndex:0}),make('2024|paper-1b|1','A velocity-time graph. Find acceleration.',{source:'past-paper',year:{year:2024},paperIndex:1})];
test('colloquial Chinese maps to English physics scenarios',()=>{
  assert.equal(rankQuestionEntries(index,'帮我找从速度时间图求加速度的题')[0].key,'ex-202-4');
  assert.equal(rankQuestionEntries(index,'想练用动量守恒解决碰撞问题')[0].key,'ex-206-1');
  assert.equal(rankQuestionEntries(index,'比較並聯電路燈泡哪個更亮')[0].key,'ex-402-1');
});
test('years, source restrictions, negative question type and exact identities',()=>{
  assert.deepEqual(rankQuestionEntries(index,'2025 加速度真题').map(e=>e.key),['2025|paper-1a|1']);
  assert.deepEqual(rankQuestionEntries(index,'加速度真题，不要选择题').map(e=>e.key),['2024|paper-1b|1']);
  for(const q of ['202 example 4','202例4','ex-202-4'])assert.equal(rankQuestionEntries(index,q)[0].key,'ex-202-4');
  assert.equal(searchIntent('找加速度题，不要碰撞').excluded[0].id,'collision');
  assert.equal(rankQuestionEntries(index,'找加速度题，不要碰撞').some(e=>e.key==='ex-206-1'),false);
});
