// Chapter summary assigns each current mistake to its main chapter once.
export function mistakeBookDistribution(chapters, books, language = 'chn') {
  const en = language === 'eng', numerals = ['一', '二', '三', '四', '五'];
  const byCode = new Map();
  const rows = books.map((book, index) => {
    const elective = index >= 5, number = elective ? index - 4 : index + 1;
    const row = { key: book.key, name: en ? `${elective ? 'Elective' : 'Compulsory'} ${number}` : `${elective ? '选修' : '必修'}${numerals[number - 1]}`, keys: [], chapters: [] };
    for (const point of book.points) {
      if (byCode.has(point.code)) continue;
      const chapter = { code: point.code, name: point.chapter, keys: [] };
      row.chapters.push(chapter);
      byCode.set(point.code, { book: row, chapter });
    }
    return row;
  });
  const unclassified = { code: 'unclassified', name: en ? 'Unclassified' : '未分类', keys: [] };
  const seen = new Set();
  for (const source of chapters) {
    const destination = byCode.get(source.code);
    for (const key of source.keys) {
      if (seen.has(key)) continue;
      seen.add(key);
      if (destination) {
        destination.book.keys.push(key);
        destination.chapter.keys.push(key);
      } else unclassified.keys.push(key);
    }
  }
  return { books: rows, unclassified };
}
