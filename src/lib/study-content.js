import { loadExercise, clearExerciseCache } from './textbook-exercises.js';
import { loadExample } from './textbook-examples.js';
import { translate } from './ui-translations.js';
const cache = new Map();
export function clearStudyCache() { cache.clear(); }
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function loadStudyQuestion(id, language) {
  const response=await fetch(`/api/content/question?${new URLSearchParams({id,language})}`,{credentials:'same-origin',cache:'no-store'});
  if(!response.ok) throw new Error(response.status===429?'请求过于频繁，请稍后重试。':'Study content could not be loaded');
  return response.json();
}

export const STUDY_CSS = `
 .study-content {font-family:"Times New Roman",SimSun,"Songti SC",serif;font-size:16px;line-height:1.5;color:#000;background:#fff;overflow-wrap:anywhere}
 .study-content p {margin:0 0 8px;white-space:normal;break-inside:avoid}
 .study-content img {max-width:100%;height:auto;object-fit:contain;border:0;background:#fff;display:inline-block;vertical-align:middle}
 .study-content .study-figure {display:block;text-align:center;margin:12px 0;break-inside:avoid}
 .study-content table {width:100%;table-layout:fixed;border-collapse:collapse;margin:8px 0;background:#fff}
 .study-content tr {break-inside:avoid}
 .study-content td {vertical-align:top;padding:6px 10px;border:0;background:#fff;overflow-wrap:anywhere}
 .study-content td p {margin-bottom:5px}
 .study-content .study-table-wrap {max-width:100%}
 .study-content sup,.study-content sub {font-size:.75em;line-height:0;position:relative;vertical-align:baseline}
 .study-content sup {top:-.5em}.study-content sub {bottom:-.25em}
 .study-content math {font-family:"Times New Roman",serif;font-size:1em;max-width:100%}
 .study-content.official-content {color:#f00}
 .study-content.reasoning-content {color:#0000ff}
 .study-source-note {font:13px/1.5 "Times New Roman",SimSun,"Songti SC",serif;color:#595959;margin:10px 0;background:#fff}
`;

export function scanHtml(paths, yearId) {
  return (paths || []).map((path) => `<p class="study-figure"><img src="assets/${escapeHtml(yearId)}/${escapeHtml(path)}" alt="${escapeHtml(path)}"/></p>`).join("");
}

export function officialAnswerHtml(content, question, yearId) {
  // Normalize verified answer text, never infer a letter from a scan or explanation.
  if (content?.officialFormat === 'text' && !/<img\b/i.test(content.official || '')) {
    const text = (content.official || '').replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').trim();
    const letter = text.match(/^(?:(?:官方答案|Official answer)\s*[:：]\s*)?([ABCD])\s*$/i);
    if (letter) return `<p>${letter[1].toUpperCase()}</p>`;
  }
  return content?.officialScreenshot || content?.officialOriginal || scanHtml(question?.answer, yearId);
}

export function printableQuestion(entry, content, { language, mode }) {
  const en = language === "eng";
  const example = entry.source === 'examples';
  const title = example ? `${en?'Textbook example':'课本例题'} ${entry.exerciseChapter} · ${entry.question.label}` : entry.source === 'textbook' ? `${en ? 'Textbook' : '课本'} ${entry.exerciseChapter} · ${entry.question.label}` : `${entry.year.year} · ${["1A", "1B", "2"][entry.paperIndex]} · ${entry.question.label}`;
  const pending = translate("详细思路尚待核验；此处不以未核验内容代替。",language);
  const question = content?.question || scanHtml(entry.question.question, entry.year.id);
  const official = example || entry.source === 'textbook' ? content?.answer : officialAnswerHtml(content, entry.question, entry.year.id);
  const isChoice = entry.paperIndex === 0 || content?.kind === 'multiple-choice' || entry.question.kind === 'multiple-choice';
  return `<article class="print-question${entry.source === 'textbook' ? ' textbook-exercise' : ''}" data-question="${escapeHtml(entry.key)}"><h2>${escapeHtml(title)}</h2>
    <div class="study-content question-content">${question}</div>
    ${mode === "questions" ? (isChoice ? `<p class="answer-line">${en ? 'Answer' : '答案'}<span class="answer-blank"></span></p>` : `<div class="working-space"></div>`) : `
      <h3>2. ${example ? 'Textbook solution' : entry.source === 'textbook' ? (en ? 'Textbook answer / worked solution' : '课本答案／解题过程') : translate("考评局官方解答／评分参考", en ? "eng" : "chn")}</h3><div class="study-content official-content">${official || `<p>${translate("暂缺官方来源。", en ? "eng" : "chn")}</p>`}</div>
      ${example ? `${content?.tips ? `<h3>Tips</h3><div class="study-content reasoning-content">${content.tips}</div>` : ''}${content?.think ? `<h3>Think about</h3><div class="study-content question-content">${content.think}</div><div class="study-content official-content">${content.thinkAnswer || ''}</div>` : ''}` : entry.source === 'textbook' && !content?.reasoning ? '' : `<h3>3. ${translate("详细思路解答", en ? "eng" : "chn")}</h3><div class="study-content reasoning-content">${content?.reasoning || `<p>${pending}</p>`}</div>`}`}
  </article>`;
}

export function preparePrintedAnswerSpaces(document) {
  const root = document.querySelector('.print-document');
  if (!root) return;
  const view = document.defaultView;
  const style = view.getComputedStyle(root);
  const pageHeight = (297 / 25.4) * 96 - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const articles = [...root.querySelectorAll('.print-question')];
  for (const article of articles) {
    const box = article.querySelector('.working-space');
    if (!box) continue;
    box.classList.remove('full-page-space');
    const top = article === articles[0]
      ? root.getBoundingClientRect().top + parseFloat(style.paddingTop)
      : article.getBoundingClientRect().top;
    // Long questions get a dedicated, full-height answer page instead of a
    // half-height box stranded on its own page. Measure after images/fonts load.
    if (box.getBoundingClientRect().bottom - top > pageHeight) {
      box.classList.add('full-page-space');
    }
  }
}

// The supplied points follow the displayed textbook order, not stable sequence IDs.
export function compareMistakePrintEntries(points = []) {
  const ranks = new Map(points.map((point, index) => [Number(point.sequence), index]));
  const rank = entry => Math.min(Number.MAX_SAFE_INTEGER, ...(entry.network?.links || [])
    .map(link => ranks.get(Number(link.sequence)) ?? Number.MAX_SAFE_INTEGER));
  const kind = entry => entry.paperIndex === 0 || entry.question?.kind === 'multiple-choice' ? 0 : 1;
  return (a, b) => (Number.isInteger(a.mistakeOrder) && Number.isInteger(b.mistakeOrder)
    ? a.mistakeOrder - b.mistakeOrder : rank(a) - rank(b) || kind(a) - kind(b))
    || (Date.parse(a.markedAt) || 0) - (Date.parse(b.markedAt) || 0)
    || a.key.localeCompare(b.key, 'en', { numeric: true });
}

export function printDocumentHtml(entries, contents, options) {
  const en = options.language === "eng";
  const date = options.date || new Date();
  const title = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日错题`;
  const compare = compareMistakePrintEntries(options.knowledgePoints);
  const rows = entries.map((entry, i) => ({ entry, content: contents[i] }))
    .sort((a, b) => compare(a.entry, b.entry));
  return `<!doctype html><html lang="${en ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><base href="${escapeHtml(options.baseUrl)}"><style>${STUDY_CSS}
    @page {size:A4;margin:0}
    * {box-sizing:border-box}body{margin:0;background:white;color:black;font:11pt/1.18 "Times New Roman",SimSun,"Songti SC",serif}
    h1{font-size:23pt;margin:0 0 12pt}h2{font-size:15.5pt;margin:0 0 10pt;break-after:avoid}h3{font-size:12.5pt;margin:14pt 0 8pt;break-after:avoid}
    .print-question{padding-top:12pt;position:relative}
    .print-watermark{position:fixed;top:148.5mm;left:105mm;width:190mm;height:auto;transform:translate(-50%,-50%) rotate(-35deg);transform-origin:center;opacity:.07;z-index:10;pointer-events:none;user-select:none}.print-question+.print-question{break-before:page}
    .study-content{font-size:11pt;line-height:1.18}.reasoning-content,.official-content{font-size:10.5pt}
    .study-content p{margin-bottom:5pt}.study-content img{max-height:7.6in;max-width:100%;object-fit:contain}
    .textbook-exercise b,.textbook-exercise strong{font-weight:inherit}.textbook-exercise i,.textbook-exercise em{font-style:normal}.textbook-exercise math{overflow:visible}
    .study-content td img{max-height:1.7in}.study-content td .study-figure{margin:5pt 0}
    .answer-line{margin:24pt 0 8pt;font-size:14pt;line-height:12mm;white-space:nowrap;break-inside:avoid}
    .answer-blank{display:inline-block;width:10ch;height:10mm;margin-left:1mm;border-bottom:1pt solid #000;vertical-align:baseline}
    .working-space{break-inside:avoid;margin-top:15pt;height:150mm;border:1pt solid #555}
    .working-space.full-page-space{break-before:page;margin-top:0;height:calc(297mm - .72in - .7in - 2px)}
    .print-document{padding:.72in .85in .7in;box-decoration-break:clone;-webkit-box-decoration-break:clone}
    .print-actions{font-family:system-ui;padding:16px;background:#fff;border-bottom:1px solid #ddd;margin-bottom:20px}.print-actions button{padding:10px;margin-right:10px}
    @media print{.print-actions{display:none}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    @media screen{body{width:210mm;margin:20px auto}.print-question+.print-question{margin-top:30px}}
    </style></head><body><img class="print-watermark" src="assets/brand/signature-${en?'eng':'chn'}.png" alt="" aria-hidden="true"/><div class="print-actions"><button id="print">${translate("打印／另存为 PDF", en ? "eng" : "chn")}</button></div><main class="print-document"><h1>${escapeHtml(title)}</h1>${rows.map(({entry, content}) => printableQuestion(entry, content, options)).join("")}</main></body></html>`;
}

export async function openMistakePrint(entries, options) {
  if (entries.length > 30) throw new Error(options.language==='eng'?'Please export up to 30 questions at a time.':'每次最多导出 30 道题，请减少选择。');
  // Open synchronously during the click, then prepare all assets before printing.
  const tab = window.open("", "_blank");
  if (!tab) throw new Error("请允许开启打印预览窗口后再试。");
  tab.opener = null;
  tab.document.body.textContent = translate("正在准备打印预览…", options.language);
  try {
    if (options.mode === 'detailed') {
      const response = await fetch('/api/membership', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.membership?.active) throw new Error('详解版 PDF 包含会员详细思路，请先开通会员。');
      clearStudyCache(); clearExerciseCache();
    }
    const contents = await Promise.all(entries.map(entry => entry.source === 'examples' ? loadExample(entry.key, options.language) : entry.source === 'textbook' ? loadExercise(options.language, entry.key) : loadStudyQuestion(entry.key, options.language)));
    if (tab.closed) throw new Error("打印预览已关闭。");
    tab.document.open();tab.document.write(printDocumentHtml(entries, contents, { ...options, baseUrl: new URL(".", window.location.href).href }));tab.document.close();
    tab.document.getElementById("print").onclick = () => tab.print();
    tab.addEventListener('beforeprint', () => preparePrintedAnswerSpaces(tab.document));
    const imageError = "部分图片未能加载，请重试后再打印。";
    await Promise.all([...tab.document.images].map((img) => img.complete ? (img.naturalWidth ? Promise.resolve() : Promise.reject(new Error(imageError))) : new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(imageError)), 30000);
      img.onload = () => {clearTimeout(timer);resolve();};img.onerror = () => {clearTimeout(timer);reject(new Error(imageError));};
    })));
    await tab.document.fonts.ready;
    preparePrintedAnswerSpaces(tab.document);
    if (!tab.closed) {tab.focus();tab.print();}
  } catch (error) {if (!tab.closed) tab.close();throw error;}
}
