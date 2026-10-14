import { MEMBERSHIP_ENABLED } from './access-policy.js';
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
  return `<article class="print-question ${isChoice ? 'print-choice' : 'print-structured'}${entry.source === 'textbook' ? ' textbook-exercise' : ''}" data-question="${escapeHtml(entry.key)}"><div class="print-question-body"><h2>${escapeHtml(title)}</h2>
    <div class="study-content question-content">${question}</div></div>
    ${mode === "questions" ? (isChoice ? '' : `<div class="working-space"></div>`) : `
      <h3>2. ${example ? 'Textbook solution' : entry.source === 'textbook' ? (en ? 'Textbook answer / worked solution' : '课本答案／解题过程') : translate("考评局官方解答／评分参考", en ? "eng" : "chn")}</h3><div class="study-content official-content">${official || `<p>${translate("暂缺官方来源。", en ? "eng" : "chn")}</p>`}</div>
      ${example ? `${content?.tips ? `<h3>Tips</h3><div class="study-content reasoning-content">${content.tips}</div>` : ''}${content?.think ? `<h3>Think about</h3><div class="study-content question-content">${content.think}</div><div class="study-content official-content">${content.thinkAnswer || ''}</div>` : ''}` : entry.source === 'textbook' && !content?.reasoning ? '' : `<h3>3. ${translate("详细思路解答", en ? "eng" : "chn")}</h3><div class="study-content reasoning-content">${content?.reasoning || `<p>${pending}</p>`}</div>`}`}
  </article>`;
}

export function preparePrintedAnswerSpaces(document) {
  const root = document.querySelector('.print-document');
  if (!root) return;
  const view = document.defaultView;
  // Match the A4 page margins in printDocumentHtml, independent of the screen
  // toolbar and header. Re-measure after assets load and before every print.
  const pageHeight = (297 - 38 - 18) / 25.4 * 96;
  // Keep each prompt with its following tables, figures and continuation
  // paragraphs. Only an oversized parent may break between its subquestions.
  for (const content of root.querySelectorAll('.print-structured .question-content')) {
    if (!content.dataset.printPartsPrepared) {
      // Some source paragraphs contain several subquestions separated by br.
      // Split only at a new leading label; retain inline formulas and formatting.
      for (const paragraph of [...content.children].filter(n => n.matches('p'))) {
        const breaks = [...paragraph.querySelectorAll('br')];
        const boundaries = breaks.filter((br, i) => {
          const range = document.createRange();
          range.setStartAfter(br);
          if (breaks[i + 1]) range.setEndBefore(breaks[i + 1]);
          else range.setEnd(paragraph, paragraph.childNodes.length);
          return /^[（(]\s*([a-z]+|\d+)\s*[)）]/i.test(range.toString().trim());
        });
        if (boundaries.length) {
          const fragment = document.createDocumentFragment();
          for (let i = 0; i <= boundaries.length; i++) {
            const range = document.createRange();
            if (i) range.setStartAfter(boundaries[i - 1]); else range.setStart(paragraph, 0);
            if (boundaries[i]) range.setEndBefore(boundaries[i]); else range.setEnd(paragraph, paragraph.childNodes.length);
            const block = paragraph.cloneNode(false);
            if (i) block.removeAttribute('id');
            block.append(range.cloneContents()); fragment.append(block);
          }
          paragraph.replaceWith(fragment);
        }
      }
      let part, subpart, outerLabel = '';
      const newPart = label => {
        part = document.createElement('section');
        part.className = 'print-part';
        part.dataset.printPart = label;
        content.append(part);
        subpart = null;
        outerLabel = label === 'introduction' ? '' : label;
      };
      const newSubpart = label => {
        subpart = document.createElement('div');
        subpart.className = 'print-subpart';
        subpart.dataset.printSubpart = label;
        part.append(subpart);
      };
      for (const node of [...content.childNodes]) {
        // Read visible labels, including labels split across Word inline tags.
        // Tables can contain labels of their own; they belong to the prompt.
        const text = node.nodeType === 1 && node.matches('p,h4,h5,h6') ? node.textContent.trim() : '';
        const match = text.match(/^[（(]\s*([a-z]+|\d+)\s*[)）](?:\s*[（(]\s*([ivx]+|\d+)\s*[)）])?/i);
        if (match) {
          const first = match[1].toLowerCase(), second = match[2]?.toLowerCase();
          const nested = !second && /^[a-z]$/.test(outerLabel) && (/^[ivx]+$/.test(first) || /^\d+$/.test(first))
            && !(first.length === 1 && outerLabel.length === 1 && first.charCodeAt(0) === outerLabel.charCodeAt(0) + 1);
          if (second) {
            if (outerLabel !== first) newPart(first);
            if (subpart && !subpart.dataset.printSubpart) subpart.classList.add('print-part-prefix');
            newSubpart(second);
          } else if (nested) {
            if (subpart && !subpart.dataset.printSubpart) subpart.classList.add('print-part-prefix');
            newSubpart(first);
          } else {
            newPart(first);
            newSubpart('');
          }
        }
        if (!part) newPart('introduction');
        if (!subpart) newSubpart('');
        subpart.append(node);
      }
      content.dataset.printPartsPrepared = 'true';
    }
    const groups = [...content.querySelectorAll('.print-part,.print-subpart')];
    for (const group of groups) group.classList.remove('oversized-print-part');
    for (const figure of content.querySelectorAll('.print-duplicate-figure')) figure.classList.remove('print-duplicate-figure');
    // Leave a small allowance for browser page rounding and keep the question
    // heading with the first prompt rather than forcing that prompt to split.
    const heading = content.previousElementSibling?.matches('h2') ? content.previousElementSibling : null;
    const headingStyle = heading && view.getComputedStyle(heading);
    const headingHeight = heading ? heading.getBoundingClientRect().height + parseFloat(headingStyle.marginTop) + parseFloat(headingStyle.marginBottom) : 0;
    const firstPart = content.querySelector('.print-part'), firstSubpart = content.querySelector('.print-subpart');
    const capacity = group => pageHeight - 2 / 25.4 * 96 - (group === firstPart || group === firstSubpart ? headingHeight : 0);
    for (const img of content.querySelectorAll('img')) {
      img.style.removeProperty('--print-max-height'); img.style.removeProperty('--print-max-width');
    }
    for (const group of content.querySelectorAll('.print-subpart')) {
      // Fit unusually tall diagrams while retaining the normal text size.
      // Shared introductions may continue; an individual prompt stays complete.
      if (group.parentElement.dataset.printPart === 'introduction') continue;
      const height = group.getBoundingClientRect().height;
      const available = capacity(group);
      if (height <= available) continue;
      // Repeated full-page source scans do not need two copies in one prompt.
      // Hide only exact duplicates in otherwise empty standalone figures.
      const seen = new Set();
      for (const figure of group.querySelectorAll('.study-figure')) {
        const imgs = figure.querySelectorAll('img');
        if (imgs.length !== 1 || figure.textContent.trim()) continue;
        const src = imgs[0].dataset.printAsset || imgs[0].getAttribute('src');
        if (seen.has(src)) figure.classList.add('print-duplicate-figure');
        else seen.add(src);
      }
      const fittedHeight = group.getBoundingClientRect().height;
      if (fittedHeight <= available) continue;
      const images = [...group.querySelectorAll('img')].map(img => ({img, rect:img.getBoundingClientRect()}));
      const imageHeight = images.reduce((sum, {rect}) => sum + rect.height, 0);
      if (imageHeight) {
        const scale = Math.max(.1, Math.min(1, (available - 2 - fittedHeight + imageHeight) / imageHeight));
        for (const {img, rect} of images) {
          img.style.setProperty('--print-max-height', `${rect.height * scale}px`);
          img.style.setProperty('--print-max-width', `${rect.width * scale}px`);
        }
      }
    }
    for (const group of groups) {
      group.classList.toggle('oversized-print-part', group.getBoundingClientRect().height > capacity(group));
    }
  }
  const articles = [...root.querySelectorAll('.print-question')];
  for (const article of articles) {
    article.classList.remove('long-question');
    const body = article.querySelector('.print-question-body');
    body?.classList.toggle('long-question-body', body.getBoundingClientRect().height > pageHeight);
    const box = article.querySelector('.working-space');
    if (box) {
      box.classList.remove('full-page-space');
      box.style.height = '';
      const gap = parseFloat(view.getComputedStyle(box).marginTop);
      const available = pageHeight - body.getBoundingClientRect().height - gap - 2;
      if (available >= 45 / 25.4 * 96) {
        // Keep a complete structured question and useful writing space together.
        box.style.height = `${Math.min(150 / 25.4 * 96, available)}px`;
      } else {
        box.classList.add('full-page-space');
      }
    }
    article.classList.toggle('long-question', article.getBoundingClientRect().height > pageHeight || !!box?.classList.contains('full-page-space'));
  }
}

// Source takes priority over type; each type follows the book/chapter codes.
// Server ordering preserves the same result when protected links are unavailable.
export function compareMistakePrintEntries(points = []) {
  const byPoint = new Map(points.map(point => [Number(point.sequence), point]));
  const numericOrder = new Intl.Collator('en', {numeric:true});
  const source = entry => entry.source === 'examples' || entry.key.startsWith('ex-') ? 0
    : entry.source === 'textbook' || entry.key.startsWith('tb-') ? 1 : 2;
  const chapter = entry => {
    const links = entry.network?.links || [];
    const primary = links.find(link => link.type === 'primary' && byPoint.has(Number(link.sequence)))
      || links.find(link => byPoint.has(Number(link.sequence)));
    return entry.exerciseChapter || entry.primaryChapterCode || byPoint.get(Number(primary?.sequence))?.code || entry.sortChapter || '';
  };
  const chapterOrder = (a, b) => {
    const x = chapter(a), y = chapter(b);
    return x && y ? numericOrder.compare(x, y) : x ? -1 : y ? 1 : 0;
  };
  const kind = entry => entry.paperIndex === 0 || entry.question?.kind === 'multiple-choice' ? 0 : 1;
  return (a, b) => source(a) - source(b) || kind(a) - kind(b)
    || (Number.isInteger(a.mistakeOrder) && Number.isInteger(b.mistakeOrder)
      ? a.mistakeOrder - b.mistakeOrder : chapterOrder(a, b))
    || (Date.parse(a.markedAt) || 0) - (Date.parse(b.markedAt) || 0)
    || a.key.localeCompare(b.key, 'en', { numeric: true });
}

export function printDocumentHtml(entries, contents, options) {
  const en = options.language === "eng";
  const date = options.date || new Date();
  const title = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日错题`;
  const compare = compareMistakePrintEntries(options.knowledgePoints);
  const rows = entries.map((entry, i) => ({ entry: {...entry, question: {...entry.question, kind: contents[i]?.kind || entry.question?.kind}}, content: contents[i] }))
    .sort((a, b) => compare(a.entry, b.entry));
  return `<!doctype html><html lang="${en ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><base href="${escapeHtml(options.baseUrl)}"><style>${STUDY_CSS}
    @page {size:A4;margin:0}
    * {box-sizing:border-box}body{margin:0;background:white;color:black;font:11.5pt/1.6 "Times New Roman",SimSun,"Songti SC",serif}
    h1{font-size:16pt;line-height:1.4;margin:0;text-align:center}h2{font-size:12.5pt;line-height:1.45;margin:0 0 10pt;break-after:avoid}h3{font-size:11.5pt;margin:14pt 0 8pt;break-after:avoid}
    .print-header{position:fixed;top:7mm;left:18mm;right:18mm;height:26mm;display:flex;align-items:flex-end;gap:12mm;padding-bottom:4mm;border-bottom:.7pt solid #000}
    .print-brand{width:38mm;flex:none;display:flex;align-items:center;flex-direction:column;gap:0}.print-brand img:first-child{width:37mm}.print-brand img:last-child{width:25mm}.print-header h1{flex:1}.print-site{position:absolute;top:0;right:0;font-size:10pt}
    .print-question{position:relative;margin:0 0 12mm;break-inside:avoid}.print-question:last-child{margin-bottom:0}
    .print-question-body{display:flow-root;break-inside:avoid}.long-question,.long-question-body{break-inside:auto}
    .print-part,.print-subpart{display:flow-root;break-inside:avoid;page-break-inside:avoid}
    .oversized-print-part{break-inside:auto;page-break-inside:auto}
    .question-content .study-table-wrap,.question-content table{break-inside:avoid;page-break-inside:avoid}
    .print-choice{padding-left:0}.print-structured:not(:first-child),.print-structured+.print-choice{break-before:page}
    .print-watermark{position:fixed;top:148.5mm;left:105mm;width:190mm;height:auto;transform:translate(-50%,-50%) rotate(-35deg);transform-origin:center;opacity:.07;z-index:10;pointer-events:none;user-select:none}
    .study-content{font-size:11.5pt;line-height:1.6}.reasoning-content,.official-content{font-size:11pt}
    .study-content p{margin-bottom:7px;orphans:2;widows:2}.study-content img{max-height:185mm;max-width:100%;object-fit:contain}
    .print-choice .question-content>.study-figure img{max-height:55mm}
    .textbook-exercise b,.textbook-exercise strong{font-weight:inherit}.textbook-exercise i,.textbook-exercise em{font-style:normal}.textbook-exercise math{overflow:visible}
    .study-content td img{max-height:1.7in}.study-content td .study-figure{margin:5pt 0}
    .print-subpart img{max-height:min(185mm,var(--print-max-height,185mm));max-width:min(100%,var(--print-max-width,100%))}
    .print-subpart td img{max-height:min(1.7in,var(--print-max-height,1.7in))}
    .print-duplicate-figure{display:none!important}
    .print-structured{margin-bottom:10mm}.print-structured h2{font-size:12pt;margin-bottom:8pt}
    .print-structured h3{font-size:11pt;margin-top:12pt;margin-bottom:6pt}
    .print-structured .study-content{font-size:11pt;line-height:1.5}
    .print-structured .study-content p{margin-bottom:6px}
    .print-structured .study-content .study-figure{margin:10px 0}
    .print-structured .study-content img{zoom:.94}
    .print-structured .study-content table{margin:6px 0}
    .print-structured .study-content td{padding:5px 10px}
    .print-structured .study-content td p{margin-bottom:4px}
    .print-structured .study-content td .study-figure{margin:4pt 0}
    .print-structured .working-space{margin-top:12pt}
    .working-space{break-inside:avoid;margin-top:15pt;height:150mm;border:1pt solid #555}
    .working-space.full-page-space{break-before:page;margin-top:0;height:calc(241mm - 2px)}
    .print-document{width:210mm;padding:38mm 18mm 18mm;box-decoration-break:clone;-webkit-box-decoration-break:clone}
    .print-actions{font-family:system-ui;padding:16px;background:#fff;border-bottom:1px solid #ddd;margin-bottom:20px}.print-actions button{padding:10px;margin-right:10px}
    @media print{.print-actions{display:none}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    @media screen{body{width:210mm;margin:20px auto;padding:7mm 18mm 18mm}.print-header{position:relative;top:auto;left:auto;right:auto;margin-bottom:5mm}.print-document{width:174mm;padding:0}.print-actions{margin:0 0 7mm}.print-watermark{position:absolute;top:148.5mm;left:50%}}
    </style></head><body class="${options.mode === 'questions' ? 'print-practice' : 'print-detailed'}"><img class="print-watermark" src="assets/brand/signature-${en?'eng':'chn'}.png" alt="" aria-hidden="true"/><div class="print-actions"><button id="print">${translate("打印／另存为 PDF", en ? "eng" : "chn")}</button></div><header class="print-header"><div class="print-brand"><img src="assets/brand/signature-chn.png" alt="高多多物理"/><img src="assets/brand/signature-eng.png" alt="ddphysics"/></div><h1>${escapeHtml(title)}</h1><span class="print-site">ddphysics.com</span></header><main class="print-document">${rows.map(({entry, content}) => printableQuestion(entry, content, options)).join("")}</main></body></html>`;
}

export async function openMistakePrint(entries, options) {
  if (entries.length > 30) throw new Error(options.language==='eng'?'Please export up to 30 questions at a time.':'每次最多导出 30 道题，请减少选择。');
  // Open synchronously during the click, then prepare all assets before printing.
  const tab = window.open("", "_blank");
  if (!tab) throw new Error("请允许开启打印预览窗口后再试。");
  tab.opener = null;
  tab.document.body.textContent = translate("正在准备打印预览…", options.language);
  try {
    if (MEMBERSHIP_ENABLED && options.mode === 'detailed') {
      const response = await fetch('/api/membership', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.membership?.active) throw new Error('详解版 PDF 包含会员详细思路，请先开通会员。');
      clearStudyCache(); clearExerciseCache();
    }
    clearStudyCache(); clearExerciseCache();
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
