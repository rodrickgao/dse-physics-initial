// Chapter totals count questions once. Knowledge coverage may link a question to several points.
export function analyzeMistakes(entries, points = [], language = 'chn') {
  const byPoint = new Map(points.map(point => [Number(point.sequence), point]));
  const chapterOrder = new Map(), pointOrder = new Map();
  for (const [index, point] of points.entries()) {
    pointOrder.set(Number(point.sequence), index);
    if (!chapterOrder.has(point.code)) chapterOrder.set(point.code, chapterOrder.size);
  }
  const chapters = new Map(), knowledge = new Map(), seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    const links = entry.network?.links || [];
    const primary = links.find(link => link.type === 'primary' && byPoint.has(Number(link.sequence)))
      || links.find(link => byPoint.has(Number(link.sequence)));
    const code = entry.primaryChapterCode || byPoint.get(Number(primary?.sequence))?.code || entry.sortChapter || 'unclassified';
    if (!chapters.has(code)) chapters.set(code, {
      code, name: points.find(point => point.code === code)?.chapter || (language === 'eng' ? 'Unclassified' : '未分类'),
      keys: [], multipleChoice: 0, structured: 0,
    });
    const chapter = chapters.get(code);
    chapter.keys.push(entry.key);
    chapter[entry.paperIndex === 0 || entry.question?.kind === 'multiple-choice' ? 'multipleChoice' : 'structured']++;
    for (const sequence of new Set(links.map(link => Number(link.sequence)).filter(id => byPoint.has(id)))) {
      if (!knowledge.has(sequence)) knowledge.set(sequence, { sequence, keys: [] });
      knowledge.get(sequence).keys.push(entry.key);
    }
  }
  return {
    chapters: [...chapters.values()].sort((a, b) => b.keys.length - a.keys.length || (chapterOrder.get(a.code) ?? Infinity) - (chapterOrder.get(b.code) ?? Infinity)),
    recommendations: [...knowledge.values()].sort((a, b) => b.keys.length - a.keys.length || pointOrder.get(a.sequence) - pointOrder.get(b.sequence)).slice(0, 3),
    pointCount: knowledge.size,
  };
}
