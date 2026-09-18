import test from 'node:test';
import assert from 'node:assert/strict';
import { profileReview } from '../src/lib/profile-review.js';
test('profile recommendations only sample current mistakes with unique knowledge counts', () => {
  const entries = Array.from({ length: 6 }, (_, i) => ({ key: `q${i}`, network: { links: [{sequence:i+1},{sequence:i+1},{sequence:10}] } }));
  const marked = {q0:{},q1:{},q2:{},q3:{},missing:{}};
  const result = profileReview(entries, marked, 'chn', () => 0);
  assert.equal(result.questions.length, 3); assert.equal(result.points.length, 3);
  assert.equal(new Set(result.questions.map(q => q.key)).size, 3);
  assert.ok(result.questions.every(q => Object.hasOwn(marked, q.key)));
  const small = profileReview(entries, {q0:{}}, 'chn');
  assert.deepEqual(new Map(small.points), new Map([[1,1],[10,1]]));
  assert.deepEqual(profileReview(entries, {}, 'chn'), {questions:[],points:[]});
});
