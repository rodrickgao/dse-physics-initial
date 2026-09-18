import * as OpenCC from 'opencc-js/t2cn';

const toSimplified = OpenCC.Converter({ from: 'hk', to: 'cn' });
export function normalizeQuestionSearch(value) {
  return toSimplified(String(value || '').normalize('NFKC').toLowerCase()).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
const compact = value => value.replace(/\s+/g, '');

export function indexQuestion(entry, questionText) {
  const metadata = [entry.year.year, entry.paper.title, entry.question.label, entry.key.replaceAll('|', ' '), entry.chapter, entry.network.keywords].join(' ');
  return { entry, questionText, body: normalizeQuestionSearch(questionText), metadata: normalizeQuestionSearch(metadata) };
}

function excerpt(text, query, terms) {
  let bestStart = 0, bestScore = -1;
  // Overlapping windows keep the actual match visible even late in long questions.
  for (let start = 0; start < text.length; start += 60) {
    const window = normalizeQuestionSearch(text.slice(start, start + 160));
    const score = (compact(window).includes(query) ? 10000 : 0)
      + terms.reduce((sum, term) => sum + (window.includes(term) ? term.length : 0), 0);
    if (score > bestScore) { bestScore = score; bestStart = start; }
    if (score >= 10000) break;
  }
  return `${bestStart ? '…' : ''}${text.slice(bestStart, bestStart + 160)}${text.length > bestStart + 160 ? '…' : ''}`;
}

export function rankQuestionEntries(index, query) {
  const normalized = normalizeQuestionSearch(query);
  if (!normalized) return [];
  const phrase = compact(normalized);
  const terms = normalized.split(/\s+/);
  const numeric = /^\d+$/.test(phrase);
  return index.flatMap(item => {
    const bodyPhrase = compact(item.body).includes(phrase);
    const metadataPhrase = compact(item.metadata).includes(phrase);
    const allBody = terms.every(term => item.body.includes(term));
    const allFields = terms.every(term => item.body.includes(term) || item.metadata.includes(term));
    if (!bodyPhrase && !metadataPhrase && !allFields) return [];
    // Continuous question text outranks topic-only matches; years remain easy to find.
    const score = numeric && metadataPhrase ? 500 : bodyPhrase ? 400 : allBody ? 300 : metadataPhrase ? 200 : 100;
    return [{ ...item.entry, score, excerpt: item.questionText ? excerpt(item.questionText, phrase, terms) : item.entry.chapter || item.entry.network.keywords }];
  }).sort((a, b) => b.score - a.score || a.yearIndex - b.yearIndex || a.paperIndex - b.paperIndex || a.questionIndex - b.questionIndex);
}
