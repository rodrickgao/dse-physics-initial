import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { chromium } from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { fixture } from './deep-test-fixture.mjs';

const output = path.resolve('../output/print-choice-align-20261013');
fs.mkdirSync(output, { recursive: true });
const f = await fixture('print-choice-align'), browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { flows: [], errors: [] };
try {
  const client = f.client(), user = await f.register(client, 'print-align@local.test');
  f.db.prepare('INSERT INTO memberships VALUES(?,?,0,1)').run(user.id, f.clock() + 30 * 86400000);
  await client.call('mistakes/import', { keys: ['2012|paper-1a|1', '2012|paper-1a|2', 'tb-E303-22'] });
  for (const language of ['chn', 'eng']) {
    f.advance(61000);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    for (const [name, value] of client.jar) await context.addCookies([{ name, value, url: f.base, httpOnly: true, sameSite: 'Strict' }]);
    await context.addInitScript(({ id, language }) => {
      localStorage.setItem('dse-physics-language-v1', language);
      localStorage.setItem('ddphysics-tour:v4:' + encodeURIComponent(id), JSON.stringify({ version: 4, status: 'skipped' }));
      window.print = () => { window.printCalled = true; };
    }, { id: user.id, language });
    const page = await context.newPage(); context.on('page', page => page.on('pageerror', e => report.errors.push(e.message)));
    await page.goto(f.base + '#mistakes'); await page.locator('[data-mistake]').first().waitFor();
    for (const mode of ['questions', 'detailed']) {
      f.advance(61000);
      const name = language === 'eng' ? (mode === 'questions' ? 'Questions' : 'Solutions') : (mode === 'questions' ? '原题版' : '详解版');
      const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('.export-controls').getByRole('button', { name, exact: true }).click()]);
      await popup.waitForFunction(() => window.printCalled);
      await popup.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode())); });
      await popup.emulateMedia({ media: 'print' });
      await popup.evaluate(() => dispatchEvent(new Event('beforeprint')));
      const metrics = await popup.evaluate(() => {
        const header = document.querySelector('.print-header').getBoundingClientRect();
        return [...document.querySelectorAll('.print-question')].map(article => ({ key: article.dataset.question, choice: article.classList.contains('print-choice'), padding: parseFloat(getComputedStyle(article).paddingLeft), titleX: article.querySelector('h2').getBoundingClientRect().left, contentX: article.querySelector('.question-content').getBoundingClientRect().left, headerX: header.left, overflow: article.scrollWidth > article.clientWidth + 1 }));
      });
      assert.ok(metrics.some(row => row.choice) && metrics.some(row => !row.choice));
      assert.ok(metrics.every(row => row.padding === 0 && Math.abs(row.titleX - row.headerX) < .2 && Math.abs(row.contentX - row.headerX) < .2 && !row.overflow));
      await popup.setViewportSize({ width: 794, height: 1123 });
      await popup.screenshot({ path: path.join(output, `${language}-${mode}.png`) });
      await popup.locator('.print-choice').first().screenshot({ path: path.join(output, `${language}-${mode}-choice.png`) });
      report.flows.push({ language, mode, actualPrintPopup: true, metrics, passed: true });
      await popup.close();
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []); report.passed = true;
} finally {
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  await browser.close(); await f.close();
  const target = path.resolve(f.directory);
  assert.ok(target.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(target).startsWith('ddphysics-deep-print-choice-align-'));
  fs.rmSync(target, { recursive: true });
}
