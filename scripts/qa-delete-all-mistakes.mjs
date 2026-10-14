import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { fixture } from './deep-test-fixture.mjs';
import { questions } from '../server/catalog.mjs';

const output = path.resolve(process.env.DSE_QA_OUTPUT || '../output/delete-all-mistakes-20261013');
fs.mkdirSync(output, { recursive: true });
const f = await fixture('delete-all-browser'), browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { views: [], flows: [], errors: [] };
const keys = ['tb-502-1', 'tb-502-21', 'ex-101-1', ...[...questions.keys()].slice(0, 8)];
const masteredKey = [...questions.keys()][20];
try {
  for (const member of [true, false]) {
    f.advance(61000);
    const client = f.client(), user = await f.register(client, `delete-${member}@local.test`);
    if (member) f.db.prepare('INSERT INTO memberships VALUES(?,?,0,1)').run(user.id, f.clock() + 30 * 86400000);
    await client.call('mistakes/import', { keys });
    await client.call('progress', { keys: [masteredKey], status: 'mastered' }, 'PUT');
    const before = (await client.call('mistakes')).data;
    for (const language of ['chn', 'eng']) for (const width of [1440, 1024, 320]) {
      f.advance(61000);
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      for (const [name, value] of client.jar) await context.addCookies([{ name, value, url: f.base, httpOnly: true, sameSite: 'Strict' }]);
      await context.addInitScript(({ id, language }) => {
        localStorage.setItem('dse-physics-language-v1', language);
        localStorage.setItem('ddphysics-tour:v4:' + encodeURIComponent(id), JSON.stringify({ version: 4, status: 'skipped' }));
      }, { id: user.id, language });
      const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
      await page.goto(f.base + '#mistakes');
      const toolbar = page.locator('#mistake-question-list>.selection-toolbar'), remove = toolbar.getByRole('button');
      await remove.waitFor();
      assert.equal(await remove.innerText(), language === 'eng' ? 'Delete all' : '全部删除');
      await toolbar.scrollIntoViewIfNeeded();
      const labelBox = await toolbar.locator('label').boundingBox(), buttonBox = await remove.boundingBox(), toolbarBox = await toolbar.boundingBox();
      assert.ok(buttonBox.x > labelBox.x + labelBox.width && Math.abs(buttonBox.x + buttonBox.width - toolbarBox.x - toolbarBox.width) < 3, 'button should align right on the same row');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      if (width === 1440 || width === 320) await toolbar.screenshot({ path: path.join(output, `toolbar-${member ? 'member' : 'free'}-${language}-${width}.png`) });
      await toolbar.locator('input').uncheck();
      await remove.click();
      const dialog = page.getByRole('dialog'), cancel = dialog.getByRole('button').first();
      await dialog.waitFor(); assert.ok((await dialog.locator('h2').innerText()).includes('11'));
      assert.ok(await cancel.evaluate(node => node === document.activeElement));
      await page.screenshot({ path: path.join(output, `${member ? 'member' : 'free'}-${language}-${width}.png`) });
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      assert.deepEqual((await client.call('mistakes')).data, before);
      assert.ok(await remove.evaluate(node => node === document.activeElement));
      report.views.push({ member, language, width, rightAligned: true, noOverflow: true, cancelAndFocus: true });
      if (width === 320) {
        // The button still targets all mistakes when only one chapter is visible.
        await page.goto(f.base + '#mistakes?chapter=502'); await remove.waitFor();
        assert.ok(await page.locator('[data-mistake]').count() < keys.length);
        await remove.click(); await dialog.waitFor(); assert.ok((await dialog.locator('h2').innerText()).includes('11'));
        let failed = true, requests = 0;
        await context.route('**/api/mistakes/trash', async route => {
          if (route.request().method() !== 'POST') return route.continue();
          requests++;
          if (failed) return route.fulfill({ status: 503, json: { error: 'Isolated save failure' } });
          await new Promise(resolve => setTimeout(resolve, 150)); await route.continue();
        });
        await dialog.getByRole('button').last().click(); await dialog.getByRole('alert').waitFor();
        assert.deepEqual((await client.call('mistakes')).data, before);
        failed = false;
        await dialog.getByRole('button').last().evaluate(node => { node.click(); node.click(); });
        await page.locator('[data-tour="mistake-empty"]').waitFor();
        assert.equal(requests, 2, 'one failed request plus one successful batch, no double submission');
        const after = (await client.call('mistakes')).data;
        assert.deepEqual(after.mistakes, {}); assert.deepEqual(after.mastered, before.mastered);
        assert.equal((await client.call('mistakes/trash')).data.trash.length, 11);
        await page.locator('[data-tour="mistake-trash-tab"]').click(); await page.locator('.mistake-trash .mistake-row').first().waitFor();
        assert.equal(await page.locator('.mistake-trash .mistake-row').count(), 11);
        await page.locator('.mistake-trash .selection-toolbar input').check();
        await page.locator('.mistake-trash .selection-toolbar button').first().click();
        await page.locator('.mistake-trash .mistake-row').first().waitFor({ state: 'hidden' });
        assert.deepEqual((await client.call('mistakes')).data, before);
        report.flows.push({ member, language, filteredAndUnselectedDeleteAll: true, failedSaveRetry: true, doubleClickProtection: true, restoredWithOriginalDates: true, masteryPreserved: true });
      }
      await context.close(); console.log(`PASS ${member} ${language} ${width}`);
    }
  }
  assert.deepEqual(report.errors, []);
  report.passed = true;
} finally {
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  await browser.close(); await f.close();
  const target = path.resolve(f.directory);
  assert.ok(target.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(target).startsWith('ddphysics-deep-delete-all-browser-'));
  fs.rmSync(target, { recursive: true });
}
