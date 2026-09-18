import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.env.QA_URL || 'http://127.0.0.1:5174/';
const output = '../output/matching-review/corrections-browser';
fs.mkdirSync(output, {recursive: true});
const fixes = JSON.parse(fs.readFileSync('../tools/matching-review/approved-corrections.json', 'utf8'));
const editions = [...new Map(fixes.map(f => [`${f.language}:${f.key}`, {language: f.language, key: f.key}])).values()];
const browser = await chromium.launch({headless: true, channel: 'chrome'});
const errors = [];
let checks = 0;
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}#papers`);
  await page.locator('.question-content').waitFor();
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height: width === 1440 ? 1000 : 844});
    for (const edition of editions) {
      const {language, key} = edition;
      if (await page.locator('html').getAttribute('lang') !== language) {
        await page.getByRole('button', {name: 'Switch language', exact: true}).click();
      }
      await page.goto(`${base}#papers?question=${encodeURIComponent(key)}`);
      const flow = page.locator(`.study-flow[data-question="${key}"]`);
      await flow.locator('.question-content').waitFor();
      await flow.locator('button[aria-controls="official-stage"]').click();
      await flow.locator('button[aria-controls="reasoning-stage"]').click();
      await flow.locator('.reasoning-content').waitFor();
      await flow.locator('.study-content img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
      assert.equal(await flow.locator('.reasoning-content').evaluate(el => getComputedStyle(el).color), 'rgb(0, 0, 255)');
      assert.equal(await flow.locator('.official-content').evaluate(el => getComputedStyle(el).color), 'rgb(255, 0, 0)');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${key} page ${width}`);
      assert.equal(await flow.locator('.study-content').evaluateAll(nodes => nodes.filter(el => el.scrollWidth > el.clientWidth + 2).length), 0, `${key} content ${width}`);
      await page.evaluate(() => document.fonts.ready);
      for (const field of new Set(fixes.filter(f => f.key === key && f.language === language).map(f => f.field))) {
        await flow.locator(field === 'question_html' ? '.question-content' : '.reasoning-content').screenshot({path: `${output}/${key.replaceAll('|', '-')}-${language}-${field}-${width}.png`});
      }
      checks++;
    }
  }
  assert.deepEqual(errors, []);
  const report = {passed: true, approvedEdits: fixes.length, editions: editions.length, renderedChecks: checks, widths: [1440, 390], errors};
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
