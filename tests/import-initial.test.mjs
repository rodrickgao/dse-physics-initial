import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApi } from '../server/api.mjs';
import { importInitialData } from '../server/import-initial.mjs';

test('initial import preserves users, clears local sessions and never overwrites live records', async () => {
  const source = mkdtempSync(join(tmpdir(), 'dse-import-source-'));
  const destination = mkdtempSync(join(tmpdir(), 'dse-import-dest-'));
  try {
    createApi({ directory: source }).close();
    const seed = new DatabaseSync(join(source, 'students.sqlite'));
    seed.prepare('INSERT INTO users(email,created_at,last_login) VALUES(?,?,?)').run('import@example.com', 1, 1);
    seed.prepare('INSERT INTO sessions VALUES(?,?,?)').run('local-session', 1, 9999999999999); seed.close();
    copyFileSync(join(source, 'students.sqlite'), join(destination, 'bootstrap.sqlite'));
    copyFileSync(join(source, 'admin-key.txt'), join(destination, 'bootstrap-admin-key.txt'));
    createApi({ directory: destination }).close();
    assert.equal(await importInitialData(destination), true);
    const db = new DatabaseSync(join(destination, 'students.sqlite'));
    assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) n FROM sessions').get().n, 0);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok'); db.close();
    assert.equal(await importInitialData(destination), false);
    rmSync(join(destination, 'bootstrap-applied.json'));
    await assert.rejects(importInitialData(destination), /Refusing to replace/);
  } finally { rmSync(source, { recursive: true, force: true }); rmSync(destination, { recursive: true, force: true }); }
});

test('private Render secret import validates integrity and preserves the one-time guard', async () => {
  const source = mkdtempSync(join(tmpdir(), 'dse-private-source-'));
  const directory = mkdtempSync(join(tmpdir(), 'dse-private-dest-'));
  const secrets = mkdtempSync(join(tmpdir(), 'dse-private-secrets-'));
  try {
    createApi({ directory: source }).close();
    const bytes = readFileSync(join(source, 'students.sqlite'));
    const bundle = { version: 1, database: bytes.toString('base64'), sha256: 'bad-hash', adminKey: 'legacy-key' };
    writeFileSync(join(secrets, 'initial-data.json'), JSON.stringify(bundle));
    await assert.rejects(importInitialData(directory, secrets), /Invalid private import/);
    assert.equal(existsSync(join(directory, 'students.sqlite')), false);
    bundle.sha256 = createHash('sha256').update(bytes).digest('hex');
    rmSync(join(secrets, 'initial-data.json'));
    const content = JSON.stringify(bundle), midpoint = Math.floor(content.length / 2);
    writeFileSync(join(secrets, 'initial-data.part1'), content.slice(0, midpoint));
    writeFileSync(join(secrets, 'initial-data.part2'), content.slice(midpoint));
    assert.equal(await importInitialData(directory, secrets), true);
    assert.equal(readFileSync(join(directory, 'admin-key.txt'), 'utf8'), 'legacy-key');
    assert.equal(await importInitialData(directory, secrets), false);
  } finally { for (const path of [source, directory, secrets]) rmSync(path, { recursive: true, force: true }); }
});
