export const PRIMARY_YEAR = 2012;
export const PAGES = ['home', 'papers', 'textbook', 'mistakes', 'focus', 'membership', 'payment', 'receipt', 'activating', 'member-success', 'admin'];

export function readRoute(hash = '') {
  const [name, query = ''] = hash.replace(/^#/, '').split('?');
  const page = PAGES.includes(name) ? name : 'home';
  const key = new URLSearchParams(query).get('question') || '';
  return {page, question: page === 'papers' && /^20\d{2}\|paper-(1a|1b|2)\|[\w.]+$/.test(key) ? key : ''};
}

export function pageHash(page, question = '') {
  return `#${PAGES.includes(page) ? page : 'home'}${page === 'papers' && question ? `?question=${encodeURIComponent(question)}` : ''}`;
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
