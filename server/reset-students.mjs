import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

// An explicit operation ID is recorded in the same transaction as the deletion.
// Retrying a deployment must never erase newly registered students.
export async function resetStudents(directory, operation) {
  if (!operation) return false;
  if (!/^[a-z0-9-]{8,80}$/.test(operation)) throw new Error('Invalid reset operation ID');
  const db = new DatabaseSync(join(directory, 'students.sqlite'));
  try {
    db.exec('PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS maintenance_operations (id TEXT PRIMARY KEY, completed_at TEXT NOT NULL, backup_path TEXT NOT NULL)');
    if (db.prepare('SELECT id FROM maintenance_operations WHERE id=?').get(operation)) return false;
    const folder = join(directory, 'reset-backups');
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    const path = join(folder, `${operation}-${Date.now()}.sqlite`);
    await backup(db, path);
    chmodSync(path, 0o600);
    const saved = new DatabaseSync(path, { readOnly: true });
    try {
      if (saved.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Reset backup failed integrity check');
    } finally { saved.close(); }
    const students = db.prepare("SELECT count(*) n FROM users WHERE role <> 'admin'").get().n;
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const table of ['payment_receipts', 'payment_orders', 'membership_audit', 'memberships', 'mistakes', 'events', 'focus_sessions', 'learning_activity', 'mistake_archive', 'codes', 'limits']) db.exec(`DELETE FROM ${table}`);
      db.exec("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role <> 'admin'); DELETE FROM users WHERE role <> 'admin'");
      if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Reset foreign key check failed');
      db.prepare('INSERT INTO maintenance_operations VALUES(?,?,?)').run(operation, new Date().toISOString(), path);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    console.log(`Student reset completed: operation=${operation}; students=${students}; verified backup=${path}`);
    return true;
  } finally { db.close(); }
}
