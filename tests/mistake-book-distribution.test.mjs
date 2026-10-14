import test from 'node:test';
import assert from 'node:assert/strict';
import { mistakeBookDistribution } from '../src/lib/mistake-book-distribution.js';
import { analyzeMistakes } from '../server/learning-analysis.mjs';
import { points as catalogPoints, questions } from '../server/catalog.mjs';

const points = [...catalogPoints.values()];
const names = ['必修第一冊','必修第二冊','必修第三冊','必修第四冊','必修第五冊','選修第一冊','選修第二冊','選修第三冊','選修第四冊'];
const books = names.map((name, i) => ({key: `${i < 5 ? 'compulsory' : 'elective'}-${i < 5 ? i + 1 : i - 4}`, points: points.filter(point => point.book === name)}));
test('book totals count every catalog question once and match ordered chapter totals', () => {
  const entries = [...questions.values()].map(q => ({key:q.key, primaryChapterCode:q.primaryChapterCode, sortChapter:q.chapterCode, question:{kind:q.kind}, network:{links:q.points.map(sequence=>({sequence}))}}));
  const summary = analyzeMistakes(entries, points);
  const result = mistakeBookDistribution(summary.chapters, books);
  assert.equal(result.books.length, 9);
  assert.deepEqual(result.books.map(b=>b.name), ['必修一','必修二','必修三','必修四','必修五','选修一','选修二','选修三','选修四']);
  assert.equal(result.books.reduce((n,b)=>n+b.keys.length,0)+result.unclassified.keys.length, questions.size);
  for (const book of result.books) {
    assert.equal(book.chapters.reduce((n,c)=>n+c.keys.length,0), book.keys.length);
    assert.deepEqual(book.chapters.map(c=>c.code), [...new Set(books.find(b=>b.key===book.key).points.map(p=>p.code))]);
    for (const chapter of book.chapters) assert.deepEqual(chapter.keys, summary.chapters.find(c=>c.code===chapter.code)?.keys || []);
  }
});
test('sparse, duplicate and unclassified data do not inflate totals or hide zero chapters', () => {
  const result = mistakeBookDistribution([{code:'101',keys:['one','one']},{code:'201',keys:['one','two']},{code:'unclassified',keys:['unknown']},{code:'missing',keys:['unknown','other']}], books, 'eng');
  assert.equal(result.books[0].keys.length, 1);
  assert.equal(result.books[1].keys.length, 1);
  assert.deepEqual(result.unclassified.keys, ['unknown','other']);
  assert.equal(result.books[8].name, 'Elective 4');
  assert.ok(result.books[8].chapters.length);
  assert.ok(result.books[8].chapters.every(c=>c.keys.length===0));
  const empty = mistakeBookDistribution([],books);
  assert.equal(empty.books.length,9);
  assert.equal(empty.books.reduce((n,b)=>n+b.keys.length,0),0);
  assert.equal(empty.books.flatMap(b=>b.chapters).length,46);
});
