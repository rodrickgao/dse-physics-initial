const normalize = value => String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim();

export function knowledgeBodyKey(point) {
  return JSON.stringify(point.formula_latex?.length
    ? ['formula', point.formula_latex.map(normalize), normalize(point.formula_notes)]
    : ['prose', normalize(point.content)]);
}

export function createKnowledgeGrouper(languages) {
  const indexes = Object.values(languages).map(points => new Map(points.map(point => [point.sequence, point])));
  const keyFor = point => JSON.stringify(indexes.map(index => {
    const edition = index.get(point.sequence);
    return edition ? knowledgeBodyKey(edition) : ['unpaired', point.sequence];
  }));
  return points => {
    const groups = new Map();
    for (const point of points) {
      // Compare both language editions and preserve every original identity.
      const key = keyFor(point);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(point);
    }
    return [...groups.values()].map(members => ({
      ...members[0],
      members,
      figures: [...new Map(members.flatMap(point => point.figures || []).map(figure =>
        [JSON.stringify([figure.src, figure.caption, figure.source, figure.page]), figure])).values()],
    }));
  };
}
