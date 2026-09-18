import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Private transfer only: place these files on the persistent disk via SFTP.
// Runs before opening the application database; never replaces populated data.
export async function importInitialData(directory) {
  mkdirSync(directory, { recursive: true });
  const sourcePath = join(directory, 'bootstrap.sqlite');
  const keyPath = join(directory, 'bootstrap-admin-key.txt');
  const marker = join(directory, 'bootstrap-applied.json');
  if (existsSync(marker) || !existsSync(sourcePath)) return false;
  if (!existsSync(keyPath) || readFileSync(keyPath, 'utf8').trim().length < 32) throw new Error('Initial import requires the original admin key.');
  const destination = join(directory, 'students.sqlite');
  if (existsSync(destination)) {
    const current = new DatabaseSync(destination, { readOnly: true });
    try {
      if (current.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get() && current.prepare('SELECT count(*) n FROM users').get().n > 0) throw new Error('Refusing to replace an existing populated database.');
    } finally { current.close(); }
  }
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    if (source.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Initial database integrity check failed.');
    for (const table of ['users', 'memberships', 'payment_orders', 'payment_receipts', 'mistakes']) source.prepare(`SELECT count(*) FROM ${table}`).get();
    await backup(source, destination);
  } finally { source.close(); }
  const imported = new DatabaseSync(destination);
  try {
    // Local sessions and unused verification codes are never carried online.
    imported.exec('DELETE FROM sessions; DELETE FROM codes; DELETE FROM limits;');
  } finally { imported.close(); }
  writeFileSync(join(directory, 'admin-key.txt'), readFileSync(keyPath), { mode: 0o600 });
  writeFileSync(marker, JSON.stringify({ importedAt: new Date().toISOString() }) + '\n', { mode: 0o600 });
  return true;
}
