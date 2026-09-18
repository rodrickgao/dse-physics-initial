import test from 'node:test';
import assert from 'node:assert/strict';
import {readRoute, pageHash, mistakeCoverage, readSaved, writeSaved} from '../src/lib/study-state.js';

test('question routes round-trip including Paper 2 structured identities', () => {
  for (const key of ['2015|paper-1a|1', '2024|paper-2|4.S', '2025|paper-2|1.1']) {
    assert.deepEqual(readRoute(pageHash('papers', key)), {page:'papers', question:key});
  }
  assert.deepEqual(readRoute('#unknown'), {page:'home', question:''});
  assert.equal(readRoute('#papers?question=not-a-question').question, '');
  assert.equal(readRoute('#home?question=2025%7Cpaper-1a%7C1').question, '');
});

test('chapter and knowledge counts deduplicate links within each question', () => {
  const links = [{sequence:1,chapterEn:'Heat',chapterZh:'熱'}, {sequence:2,chapterEn:'Heat',chapterZh:'熱'}, {sequence:1,chapterEn:'Heat',chapterZh:'熱'}];
  const {points,chapters} = mistakeCoverage([{network:{links}},{network:{links:[links[0]]}}], 'eng');
  assert.equal(chapters.get('Heat'),2);
  assert.equal(points.get(1),2);assert.equal(points.get(2),1);
});

test('unavailable storage does not interrupt reading', () => {
  assert.deepEqual(readSaved('missing', {}), {});
  assert.equal(writeSaved('missing', {}), false);
});
