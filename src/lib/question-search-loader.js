import { entriesByLanguage, yearsFor } from './data';
import { loadStudyPaper } from './study-content';
import { indexQuestion } from './question-search';

const indexes = new Map();
export function clearSearchIndexes() { indexes.clear(); }
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
