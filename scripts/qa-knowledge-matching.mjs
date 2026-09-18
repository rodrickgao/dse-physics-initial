import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.env.QA_URL || 'http://127.0.0.1:5174/';
const output = '../output/matching-review/browser';
fs.mkdirSync(output, {recursive: true});
const browser = await chromium.launch({headless: true, channel: 'chrome'});
const errors = [];
const results = [];
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}#papers`);
  await page.locator('.study-flow[data-question="2012|paper-1a|1"] .question-content').waitFor();
  const years = Array.from({length: 14}, (_, i) => String(2012 + i));
  for (const language of ['chn', 'eng']) {
    if (await page.locator('html').getAttribute('lang') !== (language === 'eng' ? 'en' : 'zh-Hant')) {
      await page.getByRole('button', {name: 'Switch language', exact: true}).click();
    }
    assert.deepEqual(await page.locator('.year-grid button').allTextContents(), years);
    for (const year of years) {
      await page.locator('.year-grid').getByRole('button', {name: year, exact: true}).click();
      await page.locator(`.study-flow[data-question="${year}|paper-1a|1"] .question-content`).waitFor();
    }
    await page.locator('#paper-search').fill('20');
    const more = page.getByRole('button', {name: language === 'eng' ? 'Show more results' : '顯示更多結果', exact: true});
    assert.equal(await page.locator('.search-result-list button').count(), 30);
    await more.click();
    assert.equal(await page.locator('.search-result-list button').count(), 60);
    const resultYears = (await page.locator('.search-result-list strong').allTextContents()).map(t => Number(t.slice(0, 4)));
    assert.deepEqual(resultYears, [...resultYears].sort((a, b) => a - b));
    await page.locator('#paper-search').fill('2025');
    assert.equal(await page.locator('.search-result-list button').count(), 30);
    await page.locator('#paper-search').fill('');
    const candidate = await page.evaluate(async () => {
      const data = await import('/src/lib/data.js');
      const point = data.pointsByLanguage.eng.find(p => !p.is_governing_law && data.relatedQuestionKeys(p.sequence).length > 10);
      return {sequence: point.sequence, keys: data.relatedQuestionKeys(point.sequence)};
    });
    await page.goto(`${base}#papers?question=${encodeURIComponent(candidate.keys[0])}`);
    await page.locator(`.study-flow[data-question="${candidate.keys[0]}"] .question-content`).waitFor();
    await page.locator('.related-panel button').filter({hasText: new RegExp(`#${candidate.sequence}(?![0-9])`)}).click();
    const card = page.locator(`#point-${candidate.sequence}`);
    await card.waitFor();
    assert.equal(await card.locator('.knowledge-questions button').count(), candidate.keys.length);
    await card.locator('.knowledge-questions summary').click();
    await card.scrollIntoViewIfNeeded();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({width, height: width === 1440 ? 1000 : 844});
      await card.locator('.knowledge-questions').scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({path: `${output}/${language}-related-${width}.png`});
      await card.screenshot({path: `${output}/${language}-card-${width}.png`});
    }
    await card.locator('.knowledge-questions button').last().click();
    await page.locator(`.study-flow[data-question="${candidate.keys.at(-1)}"] .question-content`).waitFor();
    assert.equal(new URL(await page.url()).hash, `#papers?question=${encodeURIComponent(candidate.keys.at(-1))}`);
    await page.setViewportSize({width: 1440, height: 1000});
    await page.screenshot({path: `${output}/${language}-years.png`});
    results.push({language, years, relatedSequence: candidate.sequence, accessibleRelatedQuestions: candidate.keys.length});
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${output}/report.json`, JSON.stringify({passed: true, results, widths: [1440, 390, 320], errors}, null, 2));
  console.log('PASS: bilingual ascending years, every year selection, paginated search, all related links, late-year deep links, desktop/mobile layouts.');
} finally {
  await browser.close();
}
