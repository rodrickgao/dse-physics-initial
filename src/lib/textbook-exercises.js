const requests = new Map();
export function clearExerciseCache() { requests.clear(); }
function load(url) {
  if (!requests.has(url)) requests.set(url, fetch(url, {credentials:'same-origin', cache:'no-store'}).then(response => {
    if (!response.ok) throw new Error('Exercise content could not be loaded');
    return response.json();
  }).catch(error => { requests.delete(url); throw error; }));
  return requests.get(url);
}
export function loadExerciseIndex(language) {
  if (!['eng', 'chn'].includes(language)) return Promise.reject(new Error('Invalid language'));
  return load(`assets/textbook-exercises/index-${language}.json`);
}
export function loadExercise(language, id) {
  const match = /^tb-(E?[1-5](?:A|B)?\d{2})-\d+$/.exec(id);
  if (!match || !['eng', 'chn'].includes(language)) return Promise.reject(new Error('Invalid exercise'));
  return load(`assets/textbook-exercises/${language}/${match[1]}.json`).then(data => {
    if (!data[id]) throw new Error('Exercise not found');
    return data[id];
  });
}
export function relatedExercises(index, sequences) {
  const wanted = new Set(sequences.map(Number));
  return (index?.questions || []).filter(question => question.knowledge.some(sequence => wanted.has(sequence)));
}
export function exerciseLocation(index, id) {
  const question = index.questions.find(item => item.id === id);
  if (!question) return null;
  const book = index.books.find(book => book.chapters.some(chapter => chapter.id === question.chapter));
  const chapter = book?.chapters.find(chapter => chapter.id === question.chapter);
  const section = chapter?.sections.find(section => section.id === question.section);
  return { question, book, chapter, section };
}

export function exerciseMistakeEntries(index, points, language) {
  const pointMap = new Map(points.map(p => [Number(p.sequence), p]));
  const chapters = new Map(index.books.flatMap(b => b.chapters).map(c => [c.id, c]));
  return index.questions.map(q => ({
    key: q.id, source: 'textbook', exerciseChapter: q.chapter,
    year: { year: 0, id: '' }, paperIndex: q.kind === 'multiple-choice' ? 0 : 1,
    questionIndex: Number(q.number), question: { label: `Q${q.number}`, kind: q.kind },
    paper: { title: language === 'eng' ? 'Textbook exercises' : '课本习题' },
    chapter: `${q.chapter} · ${chapters.get(q.chapter)?.title || ''}`,
    network: { links: q.knowledge.map(sequence => ({ sequence, chapterEn: pointMap.get(sequence)?.chapter, chapterZh: pointMap.get(sequence)?.chapter })) }
  }));
}
