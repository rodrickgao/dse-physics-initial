import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

// Keep schema initialization in one place. Existing databases are migrated in place.
export function openDatabase(directory) {
  const db = new DatabaseSync(join(directory, 'students.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, role TEXT NOT NULL DEFAULT 'student', created_at INTEGER NOT NULL, last_login INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS codes(email TEXT PRIMARY KEY, digest TEXT NOT NULL, salt TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, sent_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(digest TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mistakes(user_id INTEGER NOT NULL REFERENCES users(id), question_key TEXT NOT NULL, marked_at INTEGER NOT NULL, PRIMARY KEY(user_id,question_key));
    CREATE TABLE IF NOT EXISTS progress_undo(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), snapshot TEXT NOT NULL, after_state TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mastered(user_id INTEGER NOT NULL REFERENCES users(id), question_key TEXT NOT NULL, marked_at INTEGER NOT NULL, PRIMARY KEY(user_id,question_key));
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), question_key TEXT NOT NULL, action TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS focus_sessions(user_id INTEGER NOT NULL REFERENCES users(id), id TEXT NOT NULL, elapsed_ms INTEGER NOT NULL, PRIMARY KEY(user_id,id));
    CREATE TABLE IF NOT EXISTS limits(bucket TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS limits_bucket ON limits(bucket,at);
    CREATE INDEX IF NOT EXISTS events_at ON events(at);`);
  const columns = new Set(db.prepare('PRAGMA table_info(users)').all().map(c => c.name));
  for (const [name, type] of Object.entries({ nickname: 'TEXT', grade: 'TEXT', region: 'TEXT', target: 'TEXT', target_major: 'TEXT', avatar: 'TEXT', avatar_data: 'BLOB', avatar_version: 'TEXT', password_hash: 'TEXT' })) {
    if (!columns.has(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
  }
  return db;
}

// Queries remain uncached and transactions stay synchronous, as before.
export function databaseQueries(db) {
  const get = (sql, ...params) => db.prepare(sql).get(...params);
  const all = (sql, ...params) => db.prepare(sql).all(...params);
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  return { get, all, run, transaction };
}
