import { loadExerciseIndex, loadExercise, exerciseMistakeEntries } from './textbook-exercises';
import { entriesByLanguage, yearsFor, pointsByLanguage } from './data';
import { loadStudyPaper } from './study-content';
import { indexQuestion } from './question-search';

const indexes = new Map();
const unifiedIndexes = new Map();
export function clearSearchIndexes() { indexes.clear(); unifiedIndexes.clear(); }
export function questionTextFromHtml(html) {
  const document = new DOMParser().parseFromString(html || '', 'text/html');
  document.querySelectorAll('script,style,annotation').forEach(node => node.remove());
  document.querySelectorAll('p,div,br,tr,td,li').forEach(node => node.append(' '));
  return document.body.textContent.replace(/\s+/g, ' ').trim();
}

export function loadQuestionSearch(language) {
  if (!indexes.has(language)) {
    indexes.set(language, Promise.all(yearsFor(language).map(year => loadStudyPaper(year.year, language)))
      .then(papers => {
        const records = Object.assign({}, ...papers);
        return entriesByLanguage[language].map(entry => indexQuestion(entry, questionTextFromHtml(records[entry.key]?.question)));
      }).catch(error => { indexes.delete(language); throw error; }));
  }
  return indexes.get(language);
}

export function loadUnifiedQuestionSearch(language) {
  if (!unifiedIndexes.has(language)) unifiedIndexes.set(language, Promise.all([loadQuestionSearch(language), loadExerciseIndex(language)]).then(async ([papers, exercises]) => {
    const entries = exerciseMistakeEntries(exercises, pointsByLanguage[language], language);
    const chapters = exercises.books.flatMap(book => book.chapters);
    const records = {};
    let cursor = 0;
    await Promise.all(Array.from({length:4}, async () => {
      while (cursor < chapters.length) {
        const chapter = chapters[cursor++];
        const items = entries.filter(e => e.exerciseChapter === chapter.id);
        await Promise.all(items.map(async e => { records[e.key] = await loadExercise(language, e.key); }));
      }
    }));
    return [...papers.map(item => ({...item, entry:{...item.entry, source:'past-paper'}})), ...entries.map(entry => indexQuestion({...entry, yearIndex:999}, questionTextFromHtml(records[entry.key]?.question)))];
  }).catch(error => { unifiedIndexes.delete(language); throw error; }));
  return unifiedIndexes.get(language);
}
