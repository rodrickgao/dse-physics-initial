import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

globalThis.window = {};
for (const file of ['site-data.js', 'textbook-data.js', 'knowledge-network-data.js', 'paper2-knowledge-data.js', 'statistics-data.js']) {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), {filename: file});
}
const data = await import('../src/lib/data.js');

test('every bilingual year directory runs from 2012 through 2025', () => {
  const expected = Array.from({length: 14}, (_, i) => 2012 + i);
  for (const language of ['eng', 'chn']) {
    assert.deepEqual(data.yearsFor(language).map(y => Number(y.year)), expected);
    assert.equal(data.entriesByLanguage[language].length, 1116);
    const years = data.searchEntries(language, '20').map(e => Number(e.year.year));
    assert.deepEqual(years, [...years].sort((a, b) => a - b));
  }
});

test('published statistics use exactly the reviewed question links and chapters', () => {
  const stats = data.statistics;
  const entries = data.entriesByLanguage.eng;
  assert.equal(stats.summary.uniqueQuestions, entries.length);
  assert.equal(stats.summary.knowledgeLinks, entries.reduce((sum, entry) => sum + entry.network.links.length, 0));
  for (const point of stats.points) {
    const keys = data.relatedQuestionKeys(point.sequence);
    assert.deepEqual([...point.questions].sort(), [...keys].sort(), `point ${point.sequence}`);
    assert.equal(point.frequency, keys.length);
  }
  for (const chapter of stats.chapters) {
    assert.equal(chapter.questionCount, entries.filter(entry => entry.network.chapters.includes(chapter.code)).length, chapter.code);
  }
});

test('question-to-card links are bilingual, bidirectional, and chronological', () => {
  assert.deepEqual([...data.entryMaps.eng.keys()], [...data.entryMaps.chn.keys()]);
  for (const entry of data.entriesByLanguage.eng) {
    assert.deepEqual(entry.network, data.entryMaps.chn.get(entry.key).network);
    for (const link of entry.network.links || []) {
      assert.ok(data.pointsMap.eng.has(link.sequence), `${entry.key} #${link.sequence}`);
      assert.ok(data.relatedQuestionKeys(link.sequence).includes(entry.key), entry.key);
    }
  }
  for (const point of data.pointsByLanguage.eng) {
    const related = data.relatedQuestionKeys(point.sequence);
    assert.equal(related.length, new Set(related).size);
    if (point.is_governing_law) assert.equal(related.length, 0);
    assert.deepEqual(related.map(k => Number(k.split('|')[0])), related.map(k => Number(k.split('|')[0])).sort((a, b) => a - b));
    for (const key of related) {
      assert.ok(data.entryMaps.eng.get(key).network.links.some(link => link.sequence === point.sequence));
    }
  }
});
