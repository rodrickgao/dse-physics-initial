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
      const primary = links.find(link => link.type === 'primary' && points.has(Number(link.sequence))) || links.find(link => points.has(Number(link.sequence)));
      questions.get(key).primaryChapterCode = points.get(Number(primary?.sequence))?.code || '';
    });
  });
}
export function pointInfo(id) {
  const p = points.get(id);
  const en = data.DSE_TEXTBOOK_DATA.languages.eng.find(point => Number(point.sequence) === Number(id));
  return { sequence: id, number: p.number, titleEn: en?.card_title || en?.title || en?.chapter, title: p.card_title || p.title || p.content || p.chapter, chapter: p.chapter };
}

// Textbook exercises share persistent progress and mistake history with past papers.
const exercises = JSON.parse(readFileSync(new URL('../assets/textbook-exercises/index-chn.json', import.meta.url), 'utf8'));
const exercisesEn = JSON.parse(readFileSync(new URL('../assets/textbook-exercises/index-eng.json', import.meta.url), 'utf8'));
const exerciseNames = index => new Map(index.books.flatMap(book => book.chapters.map(chapter => [chapter.id, `${book.title} · ${chapter.title}`])));
const namesZh = exerciseNames(exercises), namesEn = exerciseNames(exercisesEn);
for (const q of exercises.questions) {
  questions.set(q.id, { key: q.id, source: 'textbook', label: `${namesZh.get(q.chapter)} · Q${q.number}`, labelEn: `${namesEn.get(q.chapter)} · Q${q.number}`, points: q.knowledge.filter(id => points.has(Number(id))).map(Number) });
  questions.get(q.id).primaryChapterCode = points.get(Number(q.knowledge.find(id => points.has(Number(id)))))?.code || '';
}

const examples = JSON.parse(readFileSync(new URL('../assets/textbook-examples/index-chn.json', import.meta.url), 'utf8'));
const exampleKnowledge = JSON.parse(readFileSync(new URL('../src/lib/textbook-example-knowledge.json', import.meta.url), 'utf8'));
for (const q of examples.questions) {
 const links=(exampleKnowledge[q.id] || []).filter(id=>points.has(Number(id))).map(Number);
 questions.set(q.id,{key:q.id,source:'examples',label:`${q.chapter} · E${q.number}`,labelEn:`${q.chapter} · E${q.number}`,points:links,primaryChapterCode:points.get(links[0])?.code || ''});
}

const pointOrder = new Map([...points.keys()].map((id, i) => [id, i]));
for (const question of questions.values()) {
  const first = [...question.points].sort((a, b) => pointOrder.get(a) - pointOrder.get(b))[0];
  question.chapterCode = points.get(first)?.code || '';
}
