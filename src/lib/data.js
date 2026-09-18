import { createKnowledgeGrouper } from './knowledge-groups.js';
import { numberKnowledgePoints } from './knowledge-numbering.js';

export const siteData = window.DSE_SITE_DATA;
export const textbookData = window.DSE_TEXTBOOK_DATA;
export const statistics = window.DSE_STATISTICS;
export const knowledgeNetwork = {
  ...(window.DSE_KNOWLEDGE_NETWORK || {}),
  ...(window.DSE_PAPER2_KNOWLEDGE || {}),
};

export const BOOK_ORDER = {
  eng: ["Compulsory Book 1", "Compulsory Book 2", "Compulsory Book 3", "Compulsory Book 4", "Compulsory Book 5", "Elective Book 1", "Elective Book 2", "Elective Book 3", "Elective Book 4"],
  chn: ["必修第一冊", "必修第二冊", "必修第三冊", "必修第四冊", "必修第五冊", "選修第一冊", "選修第二冊", "選修第三冊", "選修第四冊"],
};

export const PAPER_IDS = ["paper-1a", "paper-1b", "paper-2"];

export function yearsFor(language) {
  return (siteData?.years || []).filter((year) => year.language === language).sort((a, b) => Number(a.year) - Number(b.year));
}

export function questionNumber(question, fallbackIndex) {
  return Number(String(question?.label || "").replace(/\D/g, "")) || fallbackIndex + 1;
}

export function questionIdentity(question, fallbackIndex) {
  return String(question?.id || questionNumber(question, fallbackIndex));
}

export function networkKey(year, paperIndex, identity) {
  return PAPER_IDS[paperIndex] ? `${year}|${PAPER_IDS[paperIndex]}|${identity}` : "";
}

export function networkFor(year, paperIndex, question, questionIndex) {
  const exact = knowledgeNetwork[networkKey(year, paperIndex, questionIdentity(question, questionIndex))];
  if (exact) return exact;
  const fallback = Number(question?.knowledgeQuestion) || questionNumber(question, questionIndex);
  return knowledgeNetwork[networkKey(year, paperIndex, fallback)] || { links: [], keywords: "" };
}

export function imageUrl(yearId, path) {
  return `assets/${yearId}/${path}`;
}

export function questionLabelFromKey(key) {
  const [year, paper, question] = String(key).split("|");
  const paperLabel = paper === "paper-1a" ? "1A" : paper === "paper-1b" ? "1B" : "P2";
  return `${year} · ${paperLabel} · Q${question}`;
}

export const pointsByLanguage = Object.fromEntries(Object.entries(textbookData?.languages || { eng: [], chn: [] }).map(([lang, points]) => [lang, numberKnowledgePoints(points)]));
export const groupKnowledgePoints = createKnowledgeGrouper(pointsByLanguage);
export const pointsMap = Object.fromEntries(Object.entries(pointsByLanguage).map(([language, points]) => [language, new Map(points.map((point) => [Number(point.sequence), point]))]));

export function knowledgeNumber(sequence, language = 'eng') {
  return pointsMap[language]?.get(Number(sequence))?.number || String(sequence);
}

export function chapterLabel(code, language) {
  return pointsByLanguage[language]?.find(point => point.code === code)?.chapter || code;
}

export const entriesByLanguage = Object.fromEntries(["eng", "chn"].map((language) => {
  const entries = [];
  yearsFor(language).forEach((year, yearIndex) => {
    year.papers.slice(0, 3).forEach((paper, paperIndex) => {
      paper.questions.forEach((question, questionIndex) => {
        const network = networkFor(year.year, paperIndex, question, questionIndex);
        const key = networkKey(year.year, paperIndex, questionIdentity(question, questionIndex));
        const primary = network.links?.find((link) => link.type === "primary") || network.links?.[0];
        entries.push({ year, yearIndex, paper, paperIndex, question, questionIndex, network, key, chapter: primary ? (language === "eng" ? primary.chapterEn : primary.chapterZh) : (network.chapters || []).map(code => chapterLabel(code, language)).join(' / ') });
      });
    });
  });
  return [language, entries];
}));

export const entryMaps = Object.fromEntries(Object.entries(entriesByLanguage).map(([language, entries]) => [language, new Map(entries.map((entry) => [entry.key, entry]))]));

export function replaceKnowledgeNetwork(network) {
  for (const key of Object.keys(knowledgeNetwork)) delete knowledgeNetwork[key];
  Object.assign(knowledgeNetwork, network);
  for (const [language, entries] of Object.entries(entriesByLanguage)) for (const entry of entries) {
    entry.network = networkFor(entry.year.year, entry.paperIndex, entry.question, entry.questionIndex);
    const link = entry.network.links?.find(l => l.type === 'primary') || entry.network.links?.[0];
    entry.chapter = link ? (language === 'eng' ? link.chapterEn : link.chapterZh) : '';
  }
}

export function booksFor(language) {
  const points = pointsByLanguage[language] || [];
  return BOOK_ORDER[language].map((name, index) => ({
    name,
    key: `${index < 5 ? "compulsory" : "elective"}-${index < 5 ? index + 1 : index - 4}`,
    points: points.filter((point) => point.book === name),
  }));
}

export function relatedQuestionKeys(sequence) {
  const sequences = new Set((Array.isArray(sequence) ? sequence : [sequence]).map(Number));
  const keys = [];
  (entriesByLanguage.eng || []).forEach((entry) => {
    if (entry.network.links?.some((link) => sequences.has(Number(link.sequence))) && !keys.includes(entry.key)) keys.push(entry.key);
  });
  return keys;
}

export function searchable(value) {
  return String(value || "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function searchEntries(language, query) {
  const terms = searchable(query).split(" ").filter(Boolean);
  if (!terms.length) return [];
  return entriesByLanguage[language].filter((entry) => {
    const text = searchable([entry.year.year, entry.paper.title, entry.question.label, entry.chapter, entry.network.keywords].join(" "));
    return terms.every((term) => text.includes(term));
  });
}
