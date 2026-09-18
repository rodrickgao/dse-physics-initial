import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import katex from 'katex';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(site, 'textbook-data.js'), 'utf8'), context);
const data = context.window.DSE_TEXTBOOK_DATA;
const sources = JSON.parse(fs.readFileSync(path.join(site, 'scripts/textbook-source-manifest.json')));
const figures = JSON.parse(fs.readFileSync(path.join(site, 'scripts/textbook-figure-manifest.json')));
const uniqueImages = new Map();
const math = latex => katex.renderToString(latex, { throwOnError: true, strict: 'error', trust: false });

for (const language of ['eng', 'chn']) {
  const points = data.languages[language];
  assert.equal(points.length, 365);
  assert.equal(new Set(points.map(p => p.sequence)).size, 365);
  assert.equal(new Set(points.map(p => p.book_key)).size, 9);
  assert.equal(new Set(points.map(p => p.code)).size, 46);
  assert.equal(points.filter(p => p.formula_latex?.length).length, 205);
  assert.equal(points.filter(p => p.is_governing_law).length, 11);
  for (const p of points) {
    const label = language + ' #' + p.sequence;
    assert.ok(p.content?.trim(), label + ': empty content');
    assert.equal(p.importance, null, label + ': importance changed');
    assert.ok(!/Precise formula:|\uFFFD|\n(?:current|field|N S|proton)\n/.test(p.content), label + ': OCR fragments');
    const original = sources.languages[language][p.sequence];
    assert.equal(p.source, original.source, label + ': source changed');
    assert.equal(p.page, original.page, label + ': page changed');
    assert.equal(JSON.stringify(p.source_crop), JSON.stringify(original));
    for (const latex of p.formula_latex || []) math(latex);
    for (const text of [p.content, p.formula_notes, ...p.figures.map(f => f.caption)].filter(Boolean)) {
      for (const match of text.matchAll(/([A-Za-z\u0370-\u03ff]+)_([A-Za-z0-9]+)/g)) math(match[1] + '_{\\mathrm{' + match[2] + '}}');
    }
    for (const asset of [p.source_crop, ...p.figures]) {
      assert.ok(asset.source && asset.page > 0, label + ': incomplete image provenance');
      if (asset.caption !== undefined) assert.ok(asset.caption.length > 10);
      uniqueImages.set(asset.src, asset);
    }
    const other = data.languages[language === 'eng' ? 'chn' : 'eng'].find(x => x.sequence === p.sequence);
    for (const key of ['code', 'book_key', 'category_code', 'is_governing_law', 'link_policy']) assert.equal(p[key], other[key], label + ': bilingual ' + key);
    assert.equal(JSON.stringify(p.formula_latex), JSON.stringify(other.formula_latex), label + ': bilingual formulas differ');
  }
}
for (const [src, asset] of uniqueImages) {
  const png = fs.readFileSync(path.join(site, src));
  assert.equal(png.subarray(1, 4).toString(), 'PNG', src);
  assert.equal(png.readUInt32BE(16), asset.width, src + ': width');
  assert.equal(png.readUInt32BE(20), asset.height, src + ': height');
  assert.ok(asset.width > 30 && asset.height > 30, src + ': empty crop');
}
assert.equal(uniqueImages.size, 776);
assert.equal(figures.length, 46);
const point = id => data.languages.eng.find(p => p.sequence === id);
assert.equal(point(31).formula, 'pV\\propto T');
assert.ok(point(36).formula.includes('\\overline{c^2}'));
assert.ok(point(36).formula_notes.includes('m² s⁻²'));
assert.ok(point(120).content.includes('u > f:'));
assert.ok(point(187).formula.includes('\\frac{R_1}{R_1+R_2}'));
assert.ok(point(195).formula_notes.includes('sinusoidal'));
assert.ok(point(217).formula_notes.includes('NORMAL'));
assert.ok(point(221).formula.includes('-N\\frac'));
assert.ok(point(307).formula_notes.includes('no photoemission'));
assert.ok(point(335).formula_notes.includes('v = −d_uncorrected'));
assert.ok(point(350).formula.includes('\\frac12'));
assert.match(point(198).content, /conventional current/);
console.log('PASS: 730 bilingual cards, 410 formula cards, ' + data.review.expressions * 2 + ' display equations, 776 PNG assets and preserved classification/source metadata.');
