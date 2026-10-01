import { loadExerciseIndex, loadExercise, exerciseMistakeEntries } from './textbook-exercises';
import { entriesByLanguage, yearsFor, pointsByLanguage } from './data';
import { loadStudyPaper } from './study-content';
import { indexQuestion } from './question-search';

const indexes = new Map();
const unifiedIndexes = new Map();
function knowledgeText(sequence) {
  return ['chn','eng'].flatMap(lang=> {
    const p=pointsByLanguage[lang]?.find(p=>Number(p.sequence)===Number(sequence));
    return p ? [p.card_title,p.card_summary] : [];
  }).join(' ');
}
function enrich(entry) {
  return {...entry,searchKnowledge:(entry.network?.links||[]).map(link=>knowledgeText(link.sequence)).join(' ')};
}
export function knowledgeSearchIndex(language) {
  return (pointsByLanguage[language]||[]).map(p=>indexQuestion({key:`knowledge-${p.sequence}`,sequence:p.sequence,source:'knowledge',label:`${p.number} · ${p.card_title||p.chapter}`,chapter:`${p.code} · ${p.chapter}`,year:{year:0},paper:{title:'知识点 Knowledge'},question:{label:p.card_title},network:{keywords:knowledgeText(p.sequence)},yearIndex:1001,questionIndex:p.sequence},p.card_summary||p.content));
}
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
        return entriesByLanguage[language].map(entry => indexQuestion(enrich({...entry,source:'past-paper'}), questionTextFromHtml(records[entry.key]?.question)));
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
    const response=await fetch(`assets/textbook-examples/index-${language}.json`);
    if(!response.ok)throw new Error('Examples unavailable');
    const examples=await response.json();
    const exampleRecords={}; let exampleCursor=0;
    const codes=[...new Set(examples.questions.map(q=>q.chapter))];
    await Promise.all(Array.from({length:4},async()=>{while(exampleCursor<codes.length){const code=codes[exampleCursor++];const r=await fetch(`assets/textbook-examples/eng/${code}.json`);if(!r.ok)throw new Error('Example content unavailable');Object.assign(exampleRecords,await r.json());}}));
    const exampleIndex=examples.questions.map(q=>indexQuestion({key:q.id,source:'examples',label:`${q.chapter} · Example ${q.number} · ${q.title}`,chapter:q.chapter,year:{year:0},paper:{title:'课本例题 Textbook examples'},question:{label:`Example ${q.number}`},network:{keywords:q.title},yearIndex:1000,paperIndex:0,questionIndex:q.number},`${q.title} ${questionTextFromHtml(exampleRecords[q.id]?.question)}`));
    return [...papers, ...entries.map(entry => indexQuestion(enrich({...entry, yearIndex:999}), questionTextFromHtml(records[entry.key]?.question))),...exampleIndex,...knowledgeSearchIndex(language)];
  }).catch(error => { unifiedIndexes.delete(language); throw error; }));
  return unifiedIndexes.get(language);
}
