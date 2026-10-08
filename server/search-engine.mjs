import * as OpenCC from 'opencc-js/t2cn';
import { SEARCH_CONCEPTS } from './search-concepts.mjs';

const toSimplified = OpenCC.Converter({ from: 'hk', to: 'cn' });
export function normalizeQuestionSearch(value) {
  return toSimplified(String(value || '').normalize('NFKC').toLowerCase()).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
const compact = value => value.replace(/\s+/g, '');
const concepts = SEARCH_CONCEPTS.map(([id,label,aliases])=>({id,label,aliases:aliases.split('|').map(normalizeQuestionSearch)}));
const detect = text => {
  const dense=compact(text), spaced=` ${text} `;
  return concepts.filter(c=>c.aliases.some(alias=>/[\u3400-\u9fff]/.test(alias)?dense.includes(compact(alias)):spaced.includes(` ${alias} `)));
};
const stop = new Set('i want find some questions question about on the a an of to in for with please me show practice problems problem how calculate determine explain using from and or is are can would like'.split(' '));
export function searchIntent(query) {
  const text = normalizeQuestionSearch(query);
  const excluded = [];
  let positive = text.replace(/(?:不要|不含|排除|不涉及|without|exclude|excluding)\s*([^，。；,;]+?)(?=但是|但要|而是|只要|\s+but\s+|$)/g, (_,phrase)=>{excluded.push(...detect(phrase));return ' ';});
  positive = positive.replace(/我想(?:找|练|做)?|帮我找|给我|有没有|找一些|找几道|几道|相关的?题目?|练习题|题目|题型|想练|想找|有关|关于|怎么|怎样|如何|求出|计算一下|的题|的|请/g,' ');
  const matched = detect(positive);
  const terms = positive.split(/\s+/).filter(t=>t&&!stop.has(t)&&!/^\d+$/.test(t));
  const year = text.match(/\b(20[12]\d)\b/)?.[1];
  const source = /(?:例题|\d\s*例\s*\d|example|^ex )/.test(positive) ? 'examples' : /(?:真题|past paper)/.test(positive) ? 'past-paper' : /(?:课本习题|textbook exercise|^tb )/.test(positive) ? 'textbook' : null;
  const excludedSources=[['examples','例题|examples?'],['textbook','课本习题|textbook exercises?'],['past-paper','真题|past papers?']].filter(([,words])=>new RegExp(`(?:不要|排除|不含|without|exclude)\\s*(?:${words})`).test(text)).map(([id])=>id);
  const kind = /(?:不要|排除|不含)\s*(?:选择题|mc)/.test(text) ? 'structured' : /(?:选择题|multiple choice|\bmc\b)/.test(text) ? 'multiple-choice' : /(?:长题|结构题|structured)/.test(text) ? 'structured' : null;
  return {text,positive,concepts:matched,excluded,excludedSources,terms,year,source,kind};
}

export function indexQuestion(entry, questionText) {
  const metadata = [entry.year?.year, entry.paper?.title, entry.question?.label, entry.key.replaceAll('|', ' '), entry.chapter, entry.network?.keywords, entry.searchKnowledge].join(' ');
  const body = normalizeQuestionSearch(questionText), meta = normalizeQuestionSearch(metadata);
  return { entry, questionText, body, metadata:meta, concepts:detect(body+' '+meta).map(c=>c.id), bodyConcepts:detect(body).map(c=>c.id) };
}

function excerpt(text, query, terms) {
  let bestStart = 0, bestScore = -1;
  // Overlapping windows keep the actual match visible even late in long questions.
  for (let start = 0; start < text.length; start += 60) {
    const window = normalizeQuestionSearch(text.slice(start, start + 160));
    const score = (compact(window).includes(query) ? 10000 : 0)
      + terms.reduce((sum, term) => sum + (window.includes(term) ? term.length : 0), 0);
    if (score > bestScore) { bestScore = score; bestStart = start; }
    if (score >= 10000) break;
  }
  return `${bestStart ? '…' : ''}${text.slice(bestStart, bestStart + 160)}${text.length > bestStart + 160 ? '…' : ''}`;
}

export function rankQuestionEntries(index, query) {
  const normalized = normalizeQuestionSearch(query);
  if (!normalized) return [];
  const phrase = compact(normalized);
  const terms = normalized.split(/\s+/);
  const numeric = /^\d+$/.test(phrase);
  const intent = searchIntent(query);
  const direct = /^(?:ex-|tb-)?(E?[1-5](?:A|B)?\d{2})[\s-]*(?:example|例题?|q|题)?\s*-?\s*(\d+)$/i.exec(String(query).trim());
  return index.flatMap(item => {
    const entry = item.entry;
    if (intent.year && String(entry.year?.year)!==intent.year) return [];
    if (intent.source && entry.source!==intent.source) return [];
    if (intent.excludedSources.includes(entry.source)) return [];
    if (intent.kind && entry.source!=='knowledge') {
      const choice = entry.question?.kind==='multiple-choice' || (entry.source==='past-paper'&&entry.paperIndex===0);
      if ((intent.kind==='multiple-choice')!==choice) return [];
    }
    if (intent.excluded.some(c=>item.bodyConcepts?.includes(c.id))) return [];
    if (direct) {
      const matches = entry.key===`ex-${direct[1].toUpperCase()}-${Number(direct[2])}` || entry.key===`tb-${direct[1].toUpperCase()}-${Number(direct[2])}`;
      return matches ? [{...entry,score:2000,matchLabels:['题号匹配'],excerpt:item.questionText?.slice(0,160)||entry.chapter}] : [];
    }
    const bodyPhrase = compact(item.body).includes(phrase);
    const metadataPhrase = compact(item.metadata).includes(phrase);
    const allBody = terms.every(term => item.body.includes(term));
    const allFields = terms.every(term => item.body.includes(term) || item.metadata.includes(term));
    const matched = intent.concepts.filter(c=>item.concepts?.includes(c.id));
    const coverage = matched.length / Math.max(1,intent.concepts.length);
    const termMatches = intent.terms.filter(term=>item.body.includes(term)||item.metadata.includes(term));
    const semantic = matched.length>0 && coverage>=0.5;
    const lexical = intent.terms.length>0 && termMatches.length===intent.terms.length;
    if (!bodyPhrase && !metadataPhrase && !allFields && !semantic && !lexical) return [];
    // Continuous question text outranks topic-only matches; years remain easy to find.
    const exact = numeric && metadataPhrase ? 900 : bodyPhrase ? 800 : allBody ? 700 : metadataPhrase ? 600 : allFields ? 500 : 0;
    const score = exact + coverage*220 + matched.length*25 + matched.filter(c=>item.bodyConcepts?.includes(c.id)).length*30 + termMatches.length*8;
    const excerptTerms=[...terms,...matched.flatMap(c=>c.aliases)];
    return [{ ...entry, score, matchLabels:matched.map(c=>c.label), matchLabelsEn:matched.map(c=>c.aliases.find(a=>/^[a-z]/.test(a))), excerpt: item.questionText ? excerpt(item.questionText, phrase, excerptTerms) : entry.chapter || entry.network?.keywords }];
  }).sort((a, b) => b.score - a.score || a.yearIndex - b.yearIndex || a.paperIndex - b.paperIndex || a.questionIndex - b.questionIndex);
}
