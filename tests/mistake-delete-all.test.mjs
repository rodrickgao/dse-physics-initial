import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../scripts/deep-test-fixture.mjs';
import { questions } from '../server/catalog.mjs';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('bulk removal archives every mistake, preserves mastery and other accounts, and can be restored', async () => {
  const f = await fixture('delete-all');
  try {
    const a = f.client(), b = f.client(), guest = f.client();
    const user = await f.register(a, 'bulk-delete@local.test');
    await f.register(b, 'bulk-other@local.test');
    const keys = [...questions.keys()].slice(0, 512), masteredKey = [...questions.keys()][512];
    assert.equal((await a.call('mistakes/import', { keys })).status, 200);
    await a.call('progress', { keys: [masteredKey], status: 'mastered' }, 'PUT');
    await b.call('mistakes/import', { keys: [keys[0]] });
    const before = (await a.call('mistakes')).data;
    assert.equal((await guest.call('mistakes/trash', { action: 'trash', keys })).status, 401);
    assert.equal((await a.call('mistakes/trash', { action: 'trash', keys: [keys[0], 'invalid-key'] })).status, 400);
    assert.deepEqual((await a.call('mistakes')).data, before);
    const removed = await a.call('mistakes/trash', { action: 'trash', keys: [...keys, masteredKey, keys[0]] });
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.data.mistakes, {});
    assert.deepEqual(removed.data.mastered, before.mastered);
    assert.equal(removed.data.trash.length, 512);
    assert.ok(removed.data.trash.every(row => row.markedAt === Date.parse(before.mistakes[row.key].markedAt)));
    assert.equal(Object.keys((await b.call('mistakes')).data.mistakes).length, 1);
    assert.equal((await b.call('mistakes/trash')).data.trash.length, 0);
    const eventCount = () => f.db.prepare("SELECT COUNT(*) AS count FROM events WHERE user_id=? AND action='unmark'").get(user.id).count;
    assert.equal(eventCount(), 512);
    assert.equal((await a.call('mistakes/trash', { action: 'trash', keys })).status, 200);
    assert.equal(eventCount(), 512, 'retry must not add duplicate removal events');
    f.restart();
    assert.equal((await a.call('mistakes/trash')).data.trash.length, 512);
    for (let i = 0; i < keys.length; i += 500) assert.equal((await a.call('mistakes/trash', { action: 'restore', keys: keys.slice(i, i + 500) })).status, 200);
    assert.deepEqual((await a.call('mistakes')).data, before);
    assert.equal((await a.call('mistakes/trash')).data.trash.length, 0);
    const entireCatalog = [...questions.keys()];
    for (let i = 0; i < entireCatalog.length; i += 500) assert.equal((await a.call('mistakes/import', { keys: entireCatalog.slice(i, i + 500) })).status, 200);
    assert.equal((await a.call('mistakes/trash', { action: 'trash', all: true, expectedCount: entireCatalog.length - 1 })).status, 409);
    assert.equal(Object.keys((await a.call('mistakes')).data.mistakes).length, entireCatalog.length);
    const entireResult = await a.call('mistakes/trash', { action: 'trash', all: true, expectedCount: entireCatalog.length });
    assert.equal(entireResult.status, 200, 'all catalog questions must fit within the existing request limit');
    assert.deepEqual(entireResult.data.mistakes, {});
    assert.equal(entireResult.data.trash.length, entireCatalog.length);
    assert.equal(Object.keys((await b.call('mistakes')).data.mistakes).length, 1);
  } finally {
    await f.close();
    const target = path.resolve(f.directory);
    assert.ok(target.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(target).startsWith('ddphysics-deep-delete-all-'));
    rmSync(target, { recursive: true });
  }
});
