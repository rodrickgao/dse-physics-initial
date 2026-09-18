import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const output = '../output/textbook-duplicates';
const base = process.env.QA_URL || 'http://127.0.0.1:5174/';
fs.mkdirSync(output, {recursive: true});
const browser = await chromium.launch({headless: true, channel: 'chrome'});
const errors = [];
let checks = 0;
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}#textbook`);
  const groups = await page.evaluate(async () => {
    const data = await import('/src/lib/data.js');
    return data.groupKnowledgePoints(data.pointsByLanguage.eng).filter(p => p.members.length > 1).map(p => p.members.map(m => m.sequence));
  });
  assert.equal(groups.length, 15);
  for (const language of ['chn', 'eng']) {
    if (await page.locator('html').getAttribute('lang') !== (language === 'eng' ? 'en' : 'zh-Hant')) await page.getByRole('button', {name: 'Switch language', exact: true}).click();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({width, height: width === 1440 ? 1000 : 844});
      for (const ids of groups) {
        const fixture = await page.evaluate(async ({ids, language}) => {
          const data = await import('/src/lib/data.js');
          const point = data.pointsMap[language].get(ids[0]);
          return {query: point.content.slice(0, 60), keys: data.relatedQuestionKeys(ids), formulas: point.formula_latex?.length || 0};
        }, {ids, language});
        await page.locator('.knowledge-search-wrap input').fill(fixture.query);
        const card = page.locator(`[data-knowledge-sequences="${ids.join(',')}"]`);
        await card.waitFor();
        assert.equal(await card.locator('.knowledge-source').count(), ids.length);
        assert.equal(await card.locator('.knowledge-equation').count(), fixture.formulas);
        assert.equal(await card.locator('.knowledge-questions button').count(), fixture.keys.length);
        const buttons = await card.locator('.knowledge-questions button').allTextContents();
        assert.equal(new Set(buttons).size, buttons.length);
        const figures = await card.locator('.textbook-figure img').evaluateAll(imgs => imgs.map(img => img.src));
        assert.equal(new Set(figures).size, figures.length);
        assert.equal(await page.locator('.katex-error').count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${language} ${ids} ${width}`);
        if ([69,324].includes(ids[0]) && width !== 320) {
          await card.scrollIntoViewIfNeeded();
          await card.locator('.textbook-figure img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
          await card.screenshot({path: `${output}/${language}-${ids.join('-')}-${width}.png`});
        }
        checks++;
      }
    }
  }
  await page.setViewportSize({width:1440, height:1000});
  const alias = await page.evaluate(async () => {
    const data = await import('/src/lib/data.js');
    return {key: data.relatedQuestionKeys(56)[0], language: document.documentElement.lang};
  });
  await page.goto(`${base}#papers?question=${encodeURIComponent(alias.key)}`);
  await page.locator('.question-content').waitFor();
  await page.locator('.related-panel button').filter({hasText: /#56(?!\d)/}).click();
  const aliasCard = page.locator('[data-knowledge-sequences="55,56"]');
  await aliasCard.waitFor();
  assert.equal(await aliasCard.locator('#point-56').count(), 1);
  await aliasCard.locator('.knowledge-source summary').nth(1).click();
  await aliasCard.locator('.knowledge-source button').nth(1).click();
  await page.locator('dialog[open] img').evaluate(img => img.decode());
  assert.match(await page.locator('dialog[open] img').getAttribute('src'), /056\.png$/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${output}/report.json`, JSON.stringify({passed: true, groups, checks, identities:365, uniqueBodies:350, aliasNavigation:true, allSourcesRetained:true, errors}, null, 2));
  console.log(`PASS: ${checks} bilingual duplicate-group render checks, original identities/sources, unique figures/related questions, and alias navigation.`);
} finally {
  await browser.close();
}
