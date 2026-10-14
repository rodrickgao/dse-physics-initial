import { MEMBERSHIP_ENABLED } from './access-policy.js';
export const PRIMARY_YEAR = 2012;
export const PAGES = ['home', 'support', 'bank', 'ask', 'papers', 'textbook', 'exercises', 'examples', 'mistakes', 'focus', 'membership', 'payment', 'receipt', 'activating', 'member-success', 'admin'].filter(page=>MEMBERSHIP_ENABLED||!['membership','payment','receipt','activating','member-success'].includes(page));

export function readRoute(hash = '') {
  const [name, query = ''] = hash.replace(/^#/, '').split('?');
  const page = PAGES.includes(name) ? name : 'home';
  const key = new URLSearchParams(query).get('question') || '';
  const valid = page === 'papers' ? /^20\d{2}\|paper-(1a|1b|2)\|[\w.]+$/.test(key)
    : page === 'examples' ? /^ex-(?:[1-5]\d{2}|3[AB]\d{2}|E[1-4]\d{2})-[1-9]\d*$/.test(key)
    : page === 'exercises' && /^tb-E?[1-5](?:A|B)?\d{2}-\d+$/.test(key);
  return {page, question: valid ? key : ''};
}

export function pageHash(page, question = '', options = {}) {
  if(page === 'textbook' && Number.isInteger(options.knowledge) && options.knowledge>0) return `#textbook?knowledge=${options.knowledge}${Number.isSafeInteger(options.weakRevision)&&options.weakRevision>=0?`&weakRevision=${options.weakRevision}`:''}`;
  if(['exercises', 'examples'].includes(page) && !question && /^(compulsory-[1-5]|elective-[1-4])$/.test(options.book || '')) return `#${page}?book=${options.book}`;
  return `#${PAGES.includes(page) ? page : 'home'}${['papers', 'exercises', 'examples'].includes(page) && question ? `?question=${encodeURIComponent(question)}` : ''}`;
}

export function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export function writeSaved(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

// One question contributes at most once to each chapter / point, regardless of
// how many evidence links it contains. These are saved-question counts, not grades.
export function mistakeCoverage(entries, language) {
  const points = new Map();
  const chapters = new Map();
  for (const entry of entries) {
    const seenPoints = new Set();
    const seenChapters = new Set();
    for (const link of entry.network.links || []) {
      const sequence = Number(link.sequence);
      const chapter = language === 'eng' ? link.chapterEn : link.chapterZh;
      if (Number.isFinite(sequence) && !seenPoints.has(sequence)) {
        seenPoints.add(sequence); points.set(sequence, (points.get(sequence) || 0) + 1);
      }
      if (chapter && !seenChapters.has(chapter)) {
        seenChapters.add(chapter); chapters.set(chapter, (chapters.get(chapter) || 0) + 1);
      }
    }
  }
  return {points, chapters};
}

export function exerciseBookFromHash(hash) {
  const book = new URLSearchParams(String(hash).split('?')[1] || '').get('book') || '';
  return /^(compulsory-[1-5]|elective-[1-4])$/.test(book) ? book : '';
}
