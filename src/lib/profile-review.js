import { mistakeCoverage } from './study-state.js';

function sample(items, random) {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
export function profileReview(entries, mistakes, language, random = Math.random) {
  const saved = entries.filter(entry => Object.hasOwn(mistakes, entry.key));
  const coverage = mistakeCoverage(saved, language);
  return { questions: sample(saved, random), points: sample([...coverage.points], random) };
}
