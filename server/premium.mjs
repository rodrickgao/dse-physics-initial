import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { root } from './catalog.mjs';

const context = { window: {} };
for (const name of ['knowledge-network-data.js', 'paper2-knowledge-data.js', 'statistics-data.js']) runInNewContext(readFileSync(resolve(root, name), 'utf8'), context);
export const premiumNetwork = { ...context.window.DSE_KNOWLEDGE_NETWORK, ...context.window.DSE_PAPER2_KNOWLEDGE };
const stats = structuredClone(context.window.DSE_STATISTICS);
const chapterDownloads = JSON.parse(readFileSync(resolve(root, 'src/lib/textbook-downloads.json'), 'utf8'));
const chapterPdfs = new Set(Object.values(chapterDownloads).flatMap(chapters => Object.values(chapters).map(file => '/' + file.url)));
const originalPdfs = new Set(JSON.parse(readFileSync(resolve(root, 'downloads/catalog.json'), 'utf8')).files.filter(file => file.kind === 'paper' && file.edition === 'original').map(file => '/' + file.url));
for (const point of stats.points || []) { delete point.questions; }
const freeMedia = new Set(), paidMedia = new Set();
const collect = (value, set) => { for (const match of String(value || '').matchAll(/(?:src|href)=["']\/?(text-papers\/[^"'?#]+)["']/g)) set.add('/' + match[1]); };
for (const file of readdirSync(resolve(root, 'text-papers')).filter(f => /^20\d{2}-(eng|chn)\.json$/.test(f))) {
  for (const record of Object.values(JSON.parse(readFileSync(resolve(root, 'text-papers', file), 'utf8')))) {
    collect(record.question, freeMedia); collect(record.official, freeMedia); collect(record.officialScreenshot, freeMedia);
    collect(record.reasoning, paidMedia);
  }
}
// Association lists are supplied only by the authenticated API, never bootstrap scripts.
export function protectStudyFiles(req, res, active) {
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replaceAll('\\', '/'); } catch { return false; }
  const send = (content, type = 'application/javascript; charset=utf-8', status = 200) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(content); return true; };
  if (path.startsWith('/node_modules/')) return false;
  if (/(?:^|\/)(?:dist|\.git|\.local|server|tests|scripts)(?:\/|$)/i.test(path)) return send('Forbidden', 'text/plain', 403);
  if (/\/assets\/textbook\/pdfs(?:\/|$)/i.test(path)) {
    if (!chapterPdfs.has(path)) return send('Not found', 'text/plain', 404);
    if (!active) return send('An active membership is required to download chapter PDFs.', 'text/plain; charset=utf-8', 403);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Cookie');
    return false;
  }
  // Only original exam papers are distributed here; full knowledge collections are unavailable.
  if (/(?:^|\/)downloads\/.*\.pdf$/i.test(path) && !originalPdfs.has(path)) return send('Download unavailable', 'text/plain', 404);
  if (/knowledge-network-data\.js$/i.test(path)) return send('window.DSE_KNOWLEDGE_NETWORK = {};');
  if (/paper2-knowledge-data\.js$/i.test(path)) return send('window.DSE_PAPER2_KNOWLEDGE = {};');
  if (/statistics-data\.js$/i.test(path)) return send(`window.DSE_STATISTICS = ${JSON.stringify(stats)};`);
  if (/\/text-papers\//i.test(path)) {
    if (/^\/text-papers\/(media|official-screenshots)\/[\w.-]+\.(png|jpe?g|webp|svg)$/i.test(path)) {
      if (freeMedia.has(path) || (active && paidMedia.has(path))) return false;
      return send('Forbidden', 'text/plain', 403);
    }
    const match = /^\/text-papers\/(20\d{2})-(eng|chn)\.json$/.exec(path);
    if (!match) return send('Not found', 'text/plain', 404);
    try {
      const paper = JSON.parse(readFileSync(resolve(root, `text-papers/${match[1]}-${match[2]}.json`), 'utf8'));
      if (!active) for (const record of Object.values(paper)) { delete record.reasoning; delete record.reasoningStatus; record.premiumLocked = true; }
      return send(JSON.stringify(paper), 'application/json; charset=utf-8');
    } catch { return send('Not found', 'text/plain', 404); }
  }
  return false;
}
