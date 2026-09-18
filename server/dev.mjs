import { createServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createApi } from './api.mjs';
import { root } from './catalog.mjs';
import { protectStudyFiles } from './premium.mjs';

let mailer;
if (process.env.SMTP_HOST) {
  if (!process.env.SMTP_FROM || !process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('SMTP_FROM、SMTP_USER、SMTP_PASS 必須設定。');
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: process.env.SMTP_PORT !== '587', requireTLS: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 10000, socketTimeout: 15000 });
  mailer = (email, code) => transport.sendMail({ from: process.env.SMTP_FROM, to: email, subject: 'DSE Physics 登入驗證碼', text: `你的驗證碼是 ${code}，10 分鐘內有效。請勿分享此驗證碼。` });
}
const api = createApi({ directory: process.env.DSE_DATA_DIR || resolve(root, '.local'), mailer });
let vite;
const downloads = new Set(JSON.parse(readFileSync(resolve(root, 'downloads/catalog.json'), 'utf8')).files
  .filter(file => file.kind === 'paper' && file.edition === 'original').map(file => '/' + file.url));
const server = createServer((req, res) => {
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replaceAll('\\', '/'); }
  catch { res.writeHead(400); res.end('Invalid request'); return; }
  if (/(?:^|\/)downloads\/.*\.pdf$/i.test(path) && !downloads.has(path)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end('Download unavailable'); return;
  }
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '') || /(?:^|\/)(?:\.local|server|\.git|\.npm-cache)(?:\/|$)|(?:^|\/)\.env(?:[./]|$)|\.(?:sqlite(?:-wal|-shm)?|pem|key)$/i.test(path)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end('Forbidden'); return;
  }
  api.handler(req, res, () => { if (!protectStudyFiles(req, res, api.hasPremium(req))) vite.middlewares(req, res); });
});
vite = await createViteServer({ root, server: { middlewareMode: true, ws: { server } }, appType: 'spa' });
const port = Number(process.env.PORT || 5173);
server.listen(port, '127.0.0.1', () => { console.log(`本機網站：http://127.0.0.1:${port}\n開發者密鑰：${api.adminKeyPath}\n電郵模式：${mailer ? 'SMTP' : '本機預覽（不寄信）'}`); });
const shutdown = () => server.close(async () => { await vite.close(); api.close(); process.exit(0); });
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
