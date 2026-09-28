import { verificationEmail } from './verification-email.mjs';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, readdirSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, relative, extname, join } from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import nodemailer from 'nodemailer';
import { createApi } from './api.mjs';
import { root } from './catalog.mjs';
import { protectStudyFiles } from './premium.mjs';
import { importInitialData } from './import-initial.mjs';
import { resetStudents } from './reset-students.mjs';

export function productionConfig(env = process.env) {
  const origins = (env.PUBLIC_ORIGINS || (env.RENDER_EXTERNAL_HOSTNAME ? `https://${env.RENDER_EXTERNAL_HOSTNAME}` : '')).split(',').map(s => s.trim()).filter(Boolean);
  if (!origins.length || origins.some(s => { try { const u = new URL(s); return u.protocol !== 'https:' || u.origin !== s; } catch { return true; } })) throw new Error('PUBLIC_ORIGINS must contain exact HTTPS origins.');
  for (const key of ['DSE_DATA_DIR', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) if (!env[key]) throw new Error(`Missing ${key}`);
  if (![465, 587].includes(Number(env.SMTP_PORT))) throw new Error('SMTP_PORT must be 465 or 587.');
  return { origins, directory: resolve(env.DSE_DATA_DIR), port: Number(env.PORT || 10000), maintenance: env.DSE_MAINTENANCE === 'true' };
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

export function createProductionServer({ api, origins, directory = resolve(root, 'dist'), maintenance = false }) {
  const hosts = new Set(origins.map(s => new URL(s).host));
  const allowed = new Set();
  function inventory(folder) {
    for (const item of readdirSync(folder, { withFileTypes: true })) {
      if (item.name.startsWith('.')) continue;
      const file = join(folder, item.name);
      if (item.isDirectory()) inventory(file);
      else if (item.isFile() && types[extname(file).toLowerCase()]) allowed.add(relative(directory, file).replaceAll('\\', '/'));
    }
  }
  inventory(directory);
  return createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    res.setHeader('Cache-Control', 'private, no-store');
    const end = (status, message) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(message); };
    if (req.url === '/healthz' && ['GET', 'HEAD'].includes(req.method)) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, maintenance })); return; }
    if (!hosts.has(req.headers.host)) return end(403, 'Forbidden');
    if (maintenance) return end(503, '网站准备中，请稍后再来。');
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return end(400, 'Invalid request'); }
    if (path.includes('\\') || path.includes('\0') || path.split('/').some(p => p.startsWith('.')) || path.includes('//')) return end(403, 'Forbidden');
    // Use one canonical path for API, membership protection and file lookup.
    req.url = path + new URL(req.url, 'http://localhost').search;
    Promise.resolve(api.handler(req, res, () => {
      if (!['GET', 'HEAD'].includes(req.method)) return end(405, 'Method not allowed');
      if (path === '/admin' || path === '/admin/') { res.writeHead(302, { Location: '/admin.html' }); res.end(); return; }
      if (protectStudyFiles(req, res, api.hasPremium(req))) return;
      const name = path === '/' ? 'index.html' : path === '/admin' || path === '/admin/' ? 'admin.html' : path.slice(1);
      if (!allowed.has(name)) return end(404, 'Not found');
      const file = resolve(directory, name);
      res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()], 'Content-Length': statSync(file).size });
      if (req.method === 'HEAD') return res.end();
      const stream = createReadStream(file);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    })).catch(() => { if (!res.headersSent) end(500, 'Service unavailable'); else res.destroy(); });
  });
}

export async function startProduction(env = process.env) {
  const config = productionConfig(env);
  if (!existsSync(resolve(root, 'dist/index.html')) || !existsSync(resolve(root, 'dist/admin.html'))) throw new Error('Build student and admin pages first.');
  await importInitialData(config.directory);
  const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT), secure: env.SMTP_PORT === '465', requireTLS: true, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }, connectionTimeout: 10000, greetingTimeout: 10000, dnsTimeout: 10000, socketTimeout: 15000 });
  const api = createApi({ directory: config.directory, publicOrigins: config.origins, secureCookies: true, trustProxy: env.TRUST_PROXY === 'true', mailer: (email, code) => transport.sendMail(verificationEmail({from:env.SMTP_FROM,to:email,code})) });
  await resetStudents(config.directory, env.DSE_RESET_STUDENTS_ONCE);
  const server = createProductionServer({ api, origins: config.origins, maintenance: config.maintenance });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  await new Promise((done, reject) => { server.once('error', reject); server.listen(config.port, env.BIND_HOST || '0.0.0.0', done); });
  let backingUp = false;
  async function dailyBackup() {
    if (backingUp) return;
    backingUp = true;
    let db;
    try {
      const folder = join(config.directory, 'backups'); mkdirSync(folder, { recursive: true });
      db = new DatabaseSync(join(config.directory, 'students.sqlite'));
      await backup(db, join(folder, `students-${new Date().toISOString().slice(0, 10)}.sqlite`));
      for (const name of readdirSync(folder).filter(n => /^students-\d{4}-\d{2}-\d{2}\.sqlite$/.test(n)).sort().slice(0, -7)) rmSync(join(folder, name));
    } catch { console.error('Database backup failed; inspect persistent storage.'); }
    finally { db?.close(); backingUp = false; }
  }
  if (!config.maintenance) await dailyBackup();
  const timer = setInterval(dailyBackup, 86400000); timer.unref();
  console.log(`Production ready on port ${server.address().port}; maintenance=${config.maintenance}`);
  void transport.verify().then(() => console.log('SMTP connection and authentication verified; no message sent.')).catch(error => console.error('SMTP verification failed:', error.code || 'unknown'));
  const shutdown = () => { clearInterval(timer); server.close(() => { api.close(); transport.close(); process.exit(0); }); setTimeout(() => process.exit(1), 15000).unref(); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  return { server, api };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(root, 'server/production.mjs')) await startProduction();
