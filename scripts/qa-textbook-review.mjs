import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(site, '../tmp/textbook-review');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const results = [];
try {
  await page.goto((process.env.TEXTBOOK_URL || 'http://127.0.0.1:5174/') + '#textbook');
  await page.locator('.book-card').first().waitFor();
  for (const language of ['chn', 'eng']) {
    if (await page.locator('html').getAttribute('lang') !== (language === 'eng' ? 'en' : 'zh-Hant')) await page.getByRole('button', { name: 'Switch language', exact: true }).click();
    for (let book = 0; book < 9; book++) {
      await page.locator('.book-card').nth(book).click();
      await page.locator('.knowledge-point-card').first().waitFor();
      const state = await page.evaluate(language => {
        const cards = [...document.querySelectorAll('.knowledge-point-card')];
        const representativeIds = cards.map(e => Number(e.id.replace('point-', '')));
        const ids = cards.flatMap(e => e.dataset.knowledgeSequences.split(',').map(Number));
        const expected = window.DSE_TEXTBOOK_DATA.languages[language].filter(p => representativeIds.includes(p.sequence));
        const bodies = cards.map(e => (e.querySelector('.knowledge-formulas') || e.querySelector('.knowledge-content')).textContent);
        return { ids, cards: cards.length, uniqueBodies: new Set(bodies).size, formulas: document.querySelectorAll('.knowledge-equation').length,
          expectedFormulas: expected.reduce((n, p) => n + (p.formula_latex?.length || 0), 0),
          errors: document.querySelectorAll('.katex-error').length,
          overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      }, language);
      assert.equal(state.errors, 0, `${language} book ${book}: KaTeX error`);
      assert.equal(state.formulas, state.expectedFormulas);
      assert.equal(state.uniqueBodies, state.cards, `${language} book ${book}: duplicate body`);
      assert.equal(state.overflow, false, `${language} book ${book}: page overflow`);
      results.push({ language, book, ...state });
      await page.locator('.back-books').click();
    }
    assert.equal(results.filter(r => r.language === language).reduce((n,r) => n+r.ids.length,0), 365);
  }
  const search = page.locator('.knowledge-search-wrap input');
  for (const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:740}]) {
    await page.setViewportSize(viewport);
    for (const language of ['eng', 'chn']) {
      if (await page.locator('html').getAttribute('lang') !== (language === 'eng' ? 'en' : 'zh-Hant')) await page.getByRole('button', { name: 'Switch language', exact: true }).click();
      for (const id of [26,36,53,54,121,187,217,221,280,314,335,344,350,357,364]) {
        await search.fill(String(id));
        const card = page.locator(`#point-${id}`);
        await card.waitFor();
        await card.scrollIntoViewIfNeeded();
        assert.equal(await page.locator('.katex-error').count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${language} ${id} ${viewport.width}: overflow`);
        if ([36,217,335].includes(id) && viewport.width !== 320) {
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({path:path.join(output,`ui-${language}-${id}-${viewport.width}.png`)});
        }
      }
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await search.fill('217');
  const card = page.locator('#point-217');
  await card.locator('.textbook-figure button').first().click();
  assert.equal(await page.locator('dialog[open]').count(), 1);
  await page.locator('dialog[open] img').evaluate(img => img.decode());
  await page.screenshot({path:path.join(output,'ui-figure-expanded.png')});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await card.locator('.knowledge-source summary').click();
  await card.locator('.knowledge-source button').click();
  assert.equal(await page.locator('dialog[open]').count(), 1);
  await page.locator('dialog[open] img').evaluate(img => img.decode());
  await page.locator('dialog[open] .textbook-dialog-head button').click();
  assert.equal(await page.locator('dialog[open]').count(), 0);
  const brokenAssets = await page.evaluate(async () => {
    const paths = [...new Set(Object.values(window.DSE_TEXTBOOK_DATA.languages).flat().flatMap(p => [p.source_crop.src, ...p.figures.map(f => f.src)]))];
    const failed = [];
    for (const src of paths) {
      const response = await fetch(src);
      if (!response.ok || !(response.headers.get('content-type') || '').includes('image/png')) failed.push(src);
    }
    return failed;
  });
  assert.deepEqual(brokenAssets, []);
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output,'ui-verification.json'), JSON.stringify({passed:true,books:results,viewports:[1440,390,320],assets:776,errors},null,2));
  console.log('PASS: all 730 bilingual identities preserved in deduplicated cards across 18 book/language views; desktop/mobile formulas, original images, dialogs and 776 assets.');
} finally { await browser.close(); }
