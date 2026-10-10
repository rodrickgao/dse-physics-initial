import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAllRelatedQuestions } from '../src/lib/textbook-related.js';

test('related lists retain every past-paper and exercise link across API pages', async () => {
  const rows = Array.from({ length: 113 }, (_, i) => ({
    key: String(i), source: i < 23 ? 'past-paper' : 'textbook',
  }));
  const calls = [];
  const loaded = await loadAllRelatedQuestions({ language: 'chn', points: '279,404', fetcher: async url => {
    const params = new URL(url, 'http://localhost').searchParams;
    assert.equal(params.get('language'), 'chn');
    assert.equal(params.get('points'), '279,404');
    assert.equal(params.get('limit'), '50');
    const offset = Number(params.get('offset')); calls.push(offset);
    return { ok: true, json: async () => ({ results: rows.slice(offset, offset + 50), hasMore: offset + 50 < rows.length }) };
  } });
  assert.deepEqual(calls, [0, 50, 100]);
  assert.deepEqual(loaded.results, rows);
  assert.equal(loaded.results.filter(q => q.source === 'past-paper').length, 23);
  assert.equal(loaded.results.filter(q => q.source === 'textbook').length, 90);
});

test('leaving a card cancels further related-question requests', async () => {
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(loadAllRelatedQuestions({ language: 'eng', points: '2', signal: controller.signal, fetcher: async (url, options) => {
    assert.equal(options.signal, controller.signal); calls++;
    return { ok: true, json: async () => {
      controller.abort(); return { results: [{ key: 'one' }], hasMore: true };
    } };
  } }), error => error.name === 'AbortError');
  assert.equal(calls, 1);
});

test('failed or non-advancing pages do not expose incomplete totals', async () => {
  let calls = 0;
  await assert.rejects(loadAllRelatedQuestions({ language: 'chn', points: '2', fetcher: async () => {
    calls++;
    return calls === 1 ? { ok: true, json: async () => ({ results: [{ key: 'one' }], hasMore: true }) } : { ok: false };
  } }), /unavailable/);
  assert.equal(calls, 2);
  await assert.rejects(loadAllRelatedQuestions({ language: 'chn', points: '2', fetcher: async () => ({
    ok: true, json: async () => ({ results: [], hasMore: true }),
  }) }), /Invalid/);
});
