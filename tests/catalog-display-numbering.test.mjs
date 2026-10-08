import test from 'node:test';
import assert from 'node:assert/strict';
import {questions} from '../server/catalog.mjs';
import {exerciseNumber} from '../src/lib/exercise-numbering.js';
test('search and server labels use the same sequential exercise numbers as readers',()=>{
  assert.equal(exerciseNumber('tb-102-9'),5);
  for(const q of questions.values()) if(q.source==='textbook') {
    const suffix=` · Q${exerciseNumber(q.key)}`;
    assert.ok(q.label.endsWith(suffix),q.key);
    assert.ok(q.labelEn.endsWith(suffix),q.key);
  }
});
