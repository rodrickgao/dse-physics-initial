// Keep stable sequence IDs for saved links; display the document's chapter numbering.
export function numberKnowledgePoints(points) {
  const counts = new Map();
  const ordered = [...points].sort((a, b) => {
    if (!a.textbook_order || !b.textbook_order) return 0;
    const x = a.textbook_order, y = b.textbook_order;
    return x.chapter - y.chapter || x.page - y.page || x.y - y.y || a.sequence - b.sequence;
  });
  return ordered.map(point => {
    const match = /^(E?)(\d)[AB]?(\d{2})$/.exec(point.code);
    if (!match) throw new Error(`Unknown chapter code: ${point.code}`);
    const key = `${point.book}|${point.code}`;
    const ordinal = (counts.get(key) || 0) + 1;
    counts.set(key, ordinal);
    return { ...point, number: `${match[1]}${match[2]}.${Number(match[3])}.${ordinal}` };
  });
}
