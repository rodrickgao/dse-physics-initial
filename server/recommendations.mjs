// Follow the explicit links: saved mistakes -> knowledge points -> textbook exercises.
// One mistake contributes at most once to a knowledge point, even with repeated links.
function sequences(entry) {
  return [...new Set((entry.network?.links || []).map(link => Number(link.sequence))
    .filter(sequence => Number.isInteger(sequence) && sequence > 0))];
}

export function profileReview(entries, mistakes, language, batch = 0) {
  const unique = [...new Map(entries.map(entry => [entry.key, entry])).values()];
  const saved = unique.filter(entry => Object.hasOwn(mistakes, entry.key));
  const sourcesByPoint = new Map();
  for (const entry of saved) {
    for (const sequence of sequences(entry)) {
      if (!sourcesByPoint.has(sequence)) sourcesByPoint.set(sequence, new Set());
      sourcesByPoint.get(sequence).add(entry.key);
    }
  }
  const candidates = unique.filter(entry => entry.source === 'textbook' && !Object.hasOwn(mistakes, entry.key))
    .map(entry => {
      const matchedPoints = sequences(entry).filter(sequence => sourcesByPoint.has(sequence))
        .sort((a, b) => sourcesByPoint.get(b).size - sourcesByPoint.get(a).size || a - b);
      const mistakeKeys = [...new Set(matchedPoints.flatMap(sequence => [...sourcesByPoint.get(sequence)]))];
      return { ...entry, recommendation: { sequences: matchedPoints, mistakeKeys } };
    }).filter(entry => entry.recommendation.sequences.length)
    // Cover more distinct mistakes first; then more of their linked knowledge points.
    .sort((a, b) => b.recommendation.mistakeKeys.length - a.recommendation.mistakeKeys.length
      || b.recommendation.sequences.length - a.recommendation.sequences.length
      || a.key.localeCompare(b.key, 'en', { numeric: true }));
  const pageCount = Math.ceil(candidates.length / 3);
  const page = pageCount ? (Math.max(0, Math.floor(Number(batch) || 0)) % pageCount) : 0;
  const questions = candidates.slice(page * 3, page * 3 + 3);
  const shownPoints = new Set(questions.flatMap(entry => entry.recommendation.sequences));
  const points = [...shownPoints].map(sequence => [sequence, sourcesByPoint.get(sequence).size])
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return { questions, points, candidateCount: candidates.length, linkedPointCount: sourcesByPoint.size, mistakeCount: saved.length };
}
