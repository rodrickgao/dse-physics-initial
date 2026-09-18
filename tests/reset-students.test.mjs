import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createApi } from '../server/api.mjs';
import { resetStudents } from '../server/reset-students.mjs';

test('reset backs up data, preserves administrator, and never clears new students on retry', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dse-reset-'));
  let db;
  try {
    createApi({ directory }).close();
    const key = readFileSync(join(directory, 'admin-key.txt'), 'utf8');
    db = new DatabaseSync(join(directory, 'students.sqlite'));
    db.exec("PRAGMA foreign_keys=ON; INSERT INTO users(id,email,role,created_at,last_login) VALUES(1,'admin@local.invalid','admin',1,1),(2,'student@example.com','student',1,1); INSERT INTO sessions VALUES('student-session',2,9999999999999),('admin-session',1,9999999999999); INSERT INTO mistakes VALUES(2,'sample',1); INSERT INTO memberships(user_id,ends_at) VALUES(2,9999999999999);");
    assert.equal(await resetStudents(directory), false);
    assert.equal(await resetStudents(directory, 'test-reset-001'), true);
    assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 1);
    assert.equal(db.prepare('SELECT role FROM users').get().role, 'admin');
    assert.equal(db.prepare('SELECT count(*) n FROM mistakes').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) n FROM memberships').get().n, 0);
    assert.equal(db.prepare('SELECT digest FROM sessions').get().digest, 'admin-session');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(readFileSync(join(directory, 'admin-key.txt'), 'utf8'), key);
    const backup = new DatabaseSync(join(directory, 'reset-backups', readdirSync(join(directory, 'reset-backups'))[0]), { readOnly: true });
    assert.equal(backup.prepare('SELECT count(*) n FROM users').get().n, 2);
    assert.equal(backup.prepare('SELECT count(*) n FROM mistakes').get().n, 1);
    backup.close();
    db.exec("INSERT INTO users(email,created_at,last_login) VALUES('new@example.com',2,2)");
    assert.equal(await resetStudents(directory, 'test-reset-001'), false);
    assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 2);
    assert.equal(readdirSync(join(directory, 'reset-backups')).filter(name => name.endsWith('.sqlite')).length, 1);
  } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
});
