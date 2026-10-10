import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../server/database.mjs';
import {publicProfile, validateProfile} from '../server/profile.mjs';
import {REGIONS} from '../src/lib/region-catalog.js';

test('existing student databases migrate without resetting profiles or requiring a region', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dse-region-migration-'));
  let db;
  try {
    db = new DatabaseSync(join(directory, 'students.sqlite'));
    db.exec("CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT UNIQUE NOT NULL,role TEXT NOT NULL DEFAULT 'student',created_at INTEGER NOT NULL,last_login INTEGER NOT NULL,nickname TEXT,grade TEXT,target TEXT,avatar TEXT);");
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?)').run(1, 'old@example.com', 'student', 1, 2, '旧同学', '中五', '5*', 'curie-read');
    db.close(); db = openDatabase(directory);
    const profile = publicProfile(db.prepare('SELECT * FROM users WHERE id=1').get());
    assert.equal(profile.region, '');
    assert.equal(profile.avatar, 'curie-read');
    assert.equal(profile.profileComplete, true);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n, 1);
  } finally { db?.close(); rmSync(directory, {recursive: true}); }
});

test('registration accepts a default avatar and validates regions while preserving omitted values', async () => {
  assert.deepEqual(REGIONS.slice(0, 5).map(r => r.label), ['北京', '上海', '广州', '深圳', '香港']);
  const profile = {nickname: '新同学', grade: '中五', target: '5**', region: 'hong-kong'};
  const saved = await validateProfile(profile, {});
  assert.equal(saved.avatar, '');
  assert.equal(publicProfile({...saved, role: 'student'}).profileComplete, true);
  const current = {region: 'shenzhen', avatar: 'curie-read'};
  const update = {...profile}; delete update.region;
  assert.deepEqual(Object.assign({}, await validateProfile(update, current), {bytes: null}), {...saved, region: 'shenzhen', avatar: 'curie-read'});
  for (const region of ['invalid', '<script>', 1, null]) await assert.rejects(validateProfile({...profile, region}, current), {status: 400});
  await assert.rejects(validateProfile({...profile, avatar: '../private'}, current), {status: 400});
});
