import test from 'node:test';
import assert from 'node:assert/strict';
import { indexQuestion, rankQuestionEntries } from '../src/lib/question-search.js';

function entry(key, keyword = '') {
  return { key, year: { year: 2025 }, yearIndex: 0, paperIndex: 0, questionIndex: Number(key), paper: { title: '卷一甲部 Paper 1A' }, question: { label: `Q${key}` }, chapter: '熱學', network: { keywords: keyword } };
}
const index = [indexQuestion(entry('1', '溫度升幅最大'), '向物體傳遞熱量。'), indexQuestion(entry('2'), '哪個物體的溫度升幅最大？'), indexQuestion(entry('3'), 'The force acting on the moving trolley is constant.')];
test('question phrases rank before metadata and accept simplified/traditional text', () => {
  for (const query of ['溫度升幅最大', '温度升幅最大', '温度 升幅最大', '溫度，升幅最大']) assert.equal(rankQuestionEntries(index, query)[0].key, '2');
  assert.match(rankQuestionEntries(index, '温度升幅最大')[0].excerpt, /溫度升幅最大/);
});
test('English phrases, mixed fields and empty/nonmatches', () => {
  assert.equal(rankQuestionEntries(index, 'FORCE acting on')[0].key, '3');
  assert.equal(rankQuestionEntries(index, '2025 moving trolley')[0].key, '3');
  assert.equal(rankQuestionEntries(index, '２０２５').length, 3);
  for (const query of [' ', '???', '不存在的長句子', 'quantum banana']) assert.deepEqual(rankQuestionEntries(index, query), []);
});
