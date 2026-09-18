import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Private transfer only: place these files on the persistent disk via SFTP.
// Runs before opening the application database; never replaces populated data.
export async function importInitialData(directory, secretDirectory = '/etc/secrets') {
  mkdirSync(directory, { recursive: true });
  const sourcePath = join(directory, 'bootstrap.sqlite');
  const keyPath = join(directory, 'bootstrap-admin-key.txt');
  const marker = join(directory, 'bootstrap-applied.json');
  if (existsSync(marker)) return false;
  const secretPath = join(secretDirectory, 'initial-data.json');
  const part1 = join(secretDirectory, 'initial-data.part1');
  const part2 = join(secretDirectory, 'initial-data.part2');
  if (!existsSync(sourcePath) && (existsSync(secretPath) || existsSync(part1))) {
    const bundle = JSON.parse(existsSync(part1) ? readFileSync(part1, 'utf8') + readFileSync(part2, 'utf8') : readFileSync(secretPath, 'utf8'));
    const bytes = Buffer.from(bundle.database || '', 'base64');
    if (bundle.version !== 1 || bytes.subarray(0, 16).toString() !== 'SQLite format 3\0' || createHash('sha256').update(bytes).digest('hex') !== bundle.sha256 || typeof bundle.adminKey !== 'string' || bundle.adminKey.length < 32) throw new Error('Invalid private import bundle.');
    writeFileSync(keyPath, bundle.adminKey, { mode: 0o600 });
    writeFileSync(sourcePath, bytes, { mode: 0o600 });
  }
  if (!existsSync(sourcePath)) return false;
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
  let counts;
  try {
    // Local sessions and unused verification codes are never carried online.
    imported.exec('DELETE FROM sessions; DELETE FROM codes; DELETE FROM limits;');
    counts = Object.fromEntries(['users', 'memberships', 'payment_orders', 'payment_receipts', 'mistakes'].map(table => [table, imported.prepare(`SELECT count(*) n FROM ${table}`).get().n]));
  } finally { imported.close(); }
  writeFileSync(join(directory, 'admin-key.txt'), readFileSync(keyPath), { mode: 0o600 });
  writeFileSync(marker, JSON.stringify({ importedAt: new Date().toISOString(), counts }) + '\n', { mode: 0o600 });
  console.log('Initial database imported:', JSON.stringify(counts));
  return true;
}
