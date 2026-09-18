import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = process.env.QA_URL || 'http://127.0.0.1:5174/';
const output = '../output/concise-ui';
fs.mkdirSync(output, {recursive: true});
const browser = await chromium.launch({headless: true, channel: 'chrome'});
const errors = [];
let checks = 0;
try {
  for (const language of ['eng', 'chn']) {
    const page = await browser.newPage();
    await page.addInitScript(lang => localStorage.setItem('dse-physics-language-v1', lang), language);
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({width, height: width === 1440 ? 1000 : 844});
      for (const route of ['home', 'papers', 'textbook', 'mistakes']) {
        const hash = route === 'papers' ? 'papers?question=2013%7Cpaper-1b%7C1' : route;
        await page.goto(`${base}#${hash}`);
        await page.locator(`.${route === 'home' ? 'home' : route}-view`).waitFor();
        assert.equal(await page.locator('.nav-item small:not(.nav-focus-time),.continue-panel,.focus-card,.stage-guidance,.study-steps,.source-reference,.export-note').count(), 0);
        assert.equal(await page.locator('.view-heading>div>p,.welcome-row p').count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} ${language} ${width}`);
        if (route === 'papers') {
          await page.locator('.question-content').waitFor();
          const question = await page.locator('.question-content').innerHTML();
          await page.locator('button[aria-controls="official-stage"]').click();
          await page.locator('.official-content').waitFor();
          await page.locator('button[aria-controls="reasoning-stage"]').click();
          await page.locator('.reasoning-content').waitFor();
          assert.equal(await page.locator('.question-content').innerHTML(), question);
          assert.equal(await page.locator('.official-content').evaluate(el => getComputedStyle(el).color), 'rgb(255, 0, 0)');
          assert.equal(await page.locator('.reasoning-content').evaluate(el => getComputedStyle(el).color), 'rgb(0, 0, 255)');
          await page.locator('button[aria-controls="official-stage"]').click();
        }
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({path: `${output}/${route}-${language}-${width}.png`});
        checks++;
      }
    }
    await page.goto(`${base}#papers?question=2025%7Cpaper-1a%7C1`);
    await page.locator('.question-content').waitFor();
    if (language === 'chn') assert.equal(await page.getByText(/並非考評局官方中文原卷/).count(), 0);
    await page.close();
  }
  assert.deepEqual(errors, []);
  const result = {passed: true, checks, languages: ['eng', 'chn'], widths: [1440, 390, 320], errors};
  fs.writeFileSync(`${output}/report.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
