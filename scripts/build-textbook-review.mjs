import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { formulas } from './textbook-formula-catalog.mjs';
import { prose } from './textbook-prose-review.mjs';
import { figures } from './textbook-figure-catalog.mjs';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.dirname(site);
const qa = path.join(root, 'tmp/textbook-review');
fs.mkdirSync(qa, { recursive: true });
if (process.argv.includes('--figure-specs')) {
  fs.writeFileSync(path.join(qa, 'figure-specs.json'), JSON.stringify(figures, null, 2));
  process.exit(0);
}
const filename = path.join(site, 'textbook-data.js');
const backup = path.join(root, 'output/textbook-review/original-textbook-data.js');
fs.mkdirSync(path.dirname(backup), { recursive: true });
if (!fs.existsSync(backup)) fs.copyFileSync(filename, backup);
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(backup, 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(site, 'textbook-card-fixes.js'), 'utf8'), context);
const payload = context.window.DSE_TEXTBOOK_DATA;
const sourceManifest = JSON.parse(fs.readFileSync(path.join(site, 'scripts/textbook-source-manifest.json'), 'utf8'));
const figureManifest = JSON.parse(fs.readFileSync(path.join(site, 'scripts/textbook-figure-manifest.json'), 'utf8'));

function paragraphs(text, language) {
  const result = [];
  for (const line of text.replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean)) {
    if (!result.length || /^(?:[•]|\d+\s)/u.test(line) || (/[。.!?：:]$/.test(result.at(-1)) && !/\b(?:i\.e\.|e\.g\.)$/i.test(result.at(-1)))) result.push(line);
    else result[result.length-1] += (language === 'chn' && /[\u3400-\u9fff]$/.test(result.at(-1)) && /^[\u3400-\u9fff]/.test(line) ? '' : ' ') + line;
  }
  return result.join('\n');
}

let expressions = 0;
for (const entry of Object.values(formulas)) for (const latex of entry.latex) {
  katex.renderToString(latex, { throwOnError: true, strict: 'error', trust: false });
  expressions++;
}
for (const language of ['eng', 'chn']) {
  for (const point of payload.languages[language]) {
    const id = point.sequence;
    const source = sourceManifest.languages[language][id];
    if (!source || source.page !== point.page || source.source !== point.source) throw new Error(`Source mismatch ${language} #${id}`);
    if (!fs.existsSync(path.join(site, source.src))) throw new Error(`Missing source ${source.src}`);
    point.source_crop = source;
    point.content = paragraphs(prose[id]?.[language] || point.content, language);
    if (formulas[id]) {
      point.formula_latex = formulas[id].latex;
      point.formula = formulas[id].latex.join('\n');
      point.formula_notes = formulas[id].notes[language];
      point.content = point.formula_notes;
      point.display_mode = 'formula';
    }
    point.figures = figureManifest.filter(f => f.targets.includes(id)).map(({ targets, sourceSequence, previewRect, crop_pixels, render_scale, ...figure }) => ({
      ...figure, caption: figure.caption[language],
    }));
    point.review_version = '2026-09-14';
  }
}
payload.version = '2026-09-14-source-reviewed';
payload.review = { formulaPoints: Object.keys(formulas).length, expressions, originalFigures: figureManifest.length, sourceCrops: 730 };
fs.writeFileSync(filename, `window.DSE_TEXTBOOK_DATA = ${JSON.stringify(payload)};\n`);
const report = { ...payload.review, bilingualCards: 730, proseCorrections: Object.keys(prose).map(Number),
  figurePointCount: payload.languages.eng.filter(p => p.figures.length).length,
  formulaPointSequences: Object.keys(formulas).map(Number),
  scope: 'Website Textbook Knowledge; source PDFs preserved. Edited teaching notes are distinct from original source images.',
};
fs.writeFileSync(path.join(root, 'output/textbook-review/review-summary.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
