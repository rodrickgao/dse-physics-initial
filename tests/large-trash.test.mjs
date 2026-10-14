import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../scripts/deep-test-fixture.mjs';
import { questions } from '../server/catalog.mjs';
import { createHash } from 'node:crypto';

test('large trash batches restore or delete atomically with small requests, exclusions, stale-state checks and account isolation', async () => {
  const f = await fixture('large-trash');
  try {
    const a = f.client(), b = f.client();
    await f.register(a, 'large-archive@local.test'); await f.register(b, 'other-archive@local.test');
    const keys = [...questions.keys()], first = keys[0];
    for (let i = 0; i < keys.length; i += 500) assert.equal((await a.call('mistakes/import', { keys: keys.slice(i, i + 500) })).status, 200);
    await b.call('mistakes/import', { keys: [first] });
    const original = (await a.call('mistakes')).data;
    await a.call('mistakes/trash', { action: 'trash', all: true, expectedCount: keys.length });
    const fingerprint=rows=>createHash('sha256').update([...rows].sort().join('\n')).digest('hex');
    const all = { all: true, expectedCount: keys.length, selectionHash:fingerprint(keys) };
    assert.equal((await a.call('mistakes/trash', { action: 'restore', ...all, expectedCount: keys.length - 1 })).status, 409);
    assert.equal((await a.call('mistakes/trash', { action: 'delete', ...all, exceptKeys: ['invalid'] })).status, 400);
    assert.equal((await b.call('mistakes/trash', { action: 'restore', ...all })).status, 409);
    assert.equal((await a.call('mistakes/trash')).data.trash.length, keys.length);
    assert.equal((await a.call('mistakes/trash', { action: 'restore', keys: keys.slice(0, 512) })).status, 200);
    assert.equal(Object.keys((await a.call('mistakes')).data.mistakes).length, 512);
    const savedSelection={all:true,expectedCount:keys.length-512,selectionHash:fingerprint(keys.slice(512))};
    await a.call('mistakes/trash',{action:'restore',keys:[keys[512]]});
    await a.call('mistakes',{key:first,marked:false},'PUT');
    const changed=(await a.call('mistakes')).data;
    assert.equal((await a.call('mistakes/trash',{action:'restore',...savedSelection})).status,409,'same-count replacements must not change the reviewed selection');
    assert.deepEqual((await a.call('mistakes')).data,changed);
    await a.call('mistakes/trash', { action: 'trash', all: true, expectedCount: 512 });
    const restored = await a.call('mistakes/trash', { action: 'restore', ...all });
    assert.equal(restored.status, 200); assert.deepEqual(restored.data.mistakes, original.mistakes);
    await a.call('mistakes/trash', { action: 'trash', all: true, expectedCount: keys.length });
    const partial = await a.call('mistakes/trash', { action: 'restore', ...all, exceptKeys: [first], expectedCount: keys.length - 1, selectionHash:fingerprint(keys.slice(1)) });
    assert.equal(partial.status, 200); assert.equal(Object.keys(partial.data.mistakes).length, keys.length - 1);
    assert.equal(partial.data.mistakes[first], undefined); assert.deepEqual(partial.data.trash.map(row => row.key), [first]);
    await a.call('mistakes/trash', { action: 'trash', all: true, expectedCount: keys.length - 1 });
    const deleted = await a.call('mistakes/trash', { action: 'delete', ...all, exceptKeys: [first], expectedCount: keys.length - 1, selectionHash:fingerprint(keys.slice(1)) });
    assert.equal(deleted.status, 200); assert.deepEqual(deleted.data.trash.map(row => row.key), [first]);
    assert.equal((await a.call('mistakes/trash', { action: 'restore', keys: [keys[1]] })).status, 409);
    const last = await a.call('mistakes/trash', { action: 'restore', all: true, expectedCount: 1 });
    assert.equal(last.status, 200); assert.deepEqual(last.data.mistakes, { [first]: original.mistakes[first] });
    assert.deepEqual(Object.keys((await b.call('mistakes')).data.mistakes), [first]);
  } finally { await f.close(); }
});
