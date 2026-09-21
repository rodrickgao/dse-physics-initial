import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { numberKnowledgePoints } from '../src/lib/knowledge-numbering.js';

export const root = fileURLToPath(new URL('../', import.meta.url));
const context = { window: {} };
for (const file of ['site-data.js', 'textbook-data.js', 'knowledge-network-data.js', 'paper2-knowledge-data.js']) {
  runInNewContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
}
const data = context.window;
const network = { ...data.DSE_KNOWLEDGE_NETWORK, ...data.DSE_PAPER2_KNOWLEDGE };
export const points = new Map(numberKnowledgePoints(data.DSE_TEXTBOOK_DATA.languages.chn).map(p => [Number(p.sequence), p]));
export const questions = new Map();
for (const year of data.DSE_SITE_DATA.years.filter(y => y.language === 'chn')) {
  year.papers.slice(0, 3).forEach((paper, index) => {
    const paperId = ['paper-1a', 'paper-1b', 'paper-2'][index];
    paper.questions.forEach((q, i) => {
      const number = Number(String(q.label || '').replace(/\D/g, '')) || i + 1;
      const key = `${year.year}|${paperId}|${q.id || number}`;
      const links = (network[key] || network[`${year.year}|${paperId}|${Number(q.knowledgeQuestion) || number}`] || {}).links || [];
      questions.set(key, { key, label: `${year.year} · ${['1A', '1B', '2'][index]} · ${q.label || number}`, points: [...new Set(links.map(l => Number(l.sequence)))].filter(id => points.has(id)) });
    });
  });
}
export function pointInfo(id) {
  const p = points.get(id);
  const en = data.DSE_TEXTBOOK_DATA.languages.eng.find(point => Number(point.sequence) === Number(id));
  return { sequence: id, number: p.number, titleEn: en?.card_title || en?.title || en?.chapter, title: p.card_title || p.title || p.content || p.chapter, chapter: p.chapter };
}
