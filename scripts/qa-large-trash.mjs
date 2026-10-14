import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { fixture, output } from './deep-test-fixture.mjs';
import { questions } from '../server/catalog.mjs';

const f = await fixture('large-trash-ui'), browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { flows: [], errors: [], requests: [] };
const keys = [...questions.keys()];
try {
  const client = f.client(), user = await f.register(client, 'large-trash-ui@local.test');
  for (const language of ['chn', 'eng']) {
    f.advance(61000);
    for (let i = 0; i < keys.length; i += 500) assert.equal((await client.call('mistakes/import', { keys: keys.slice(i, i + 500) })).status, 200);
    const original = (await client.call('mistakes')).data;
    const context = await browser.newContext({ viewport: { width: language === 'chn' ? 1440 : 320, height: 1000 }, reducedMotion: 'reduce' });
    for (const [name, value] of client.jar) await context.addCookies([{ name, value, url: f.base, httpOnly: true, sameSite: 'Strict' }]);
    await context.addInitScript(({ id, language }) => { try { localStorage.setItem('dse-physics-language-v1', language); localStorage.setItem('ddphysics-tour:v4:' + encodeURIComponent(id), JSON.stringify({ version: 4, status: 'skipped' })); } catch {} }, { id: user.id, language });
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => report.errors.push(error.message));
    let failRestore = language === 'eng', restoreRequests = 0;
    await context.route('**/api/mistakes/trash', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      const body = route.request().postDataJSON(); report.requests.push({ language, action: body.action, bytes: route.request().postData().length, all: body.all, expectedCount: body.expectedCount, exclusions: body.exceptKeys?.length });
      if (body.action === 'restore') {
        restoreRequests++;
        if (failRestore) { failRestore = false; return route.fulfill({ status: 503, json: { error: 'Isolated large restore retry' } }); }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return route.continue();
    });
    const archiveAll = async () => {
      await page.locator('[data-tour="mistake-active-tab"]').click(); await page.locator('#mistake-question-list').waitFor();
      await page.locator('#mistake-question-list>.selection-toolbar button').click(); await page.getByRole('dialog').locator('.selection-toolbar button').last().click();
      await page.locator('[data-tour="mistake-empty"]').waitFor();
      await page.locator('[data-tour="mistake-trash-tab"]').click(); await page.locator('.mistake-trash .mistake-row').first().waitFor();
    };
    await page.goto(f.base + '#mistakes'); await archiveAll();
    const trash = page.locator('.mistake-trash'), toolbar = trash.locator('>.selection-toolbar');
    assert.equal(await trash.locator('.mistake-row').count(), keys.length);
    await toolbar.locator('input').check();
    const excluded = (await client.call('mistakes/trash')).data.trash[0].key;
    await trash.locator('.mistake-row>input').first().uncheck();
    await toolbar.locator('button').first().evaluate(node => { node.click(); node.click(); });
    if (language === 'eng') {
      await trash.getByRole('alert').waitFor(); assert.equal((await client.call('mistakes/trash')).data.trash.length, keys.length);
      await toolbar.locator('button').first().evaluate(node => { node.click(); node.click(); });
    }
    await page.waitForFunction(() => document.querySelectorAll('.mistake-trash .mistake-row').length === 1);
    assert.equal(restoreRequests, language === 'eng' ? 2 : 1);
    const partial = (await client.call('mistakes')).data;
    assert.equal(Object.keys(partial.mistakes).length, keys.length - 1); assert.equal(partial.mistakes[excluded], undefined);
    for (const [key, state] of Object.entries(partial.mistakes)) assert.equal(state.markedAt, original.mistakes[key].markedAt);
    await archiveAll(); await toolbar.locator('input').check();
    const retained = (await client.call('mistakes/trash')).data.trash[0].key;
    await trash.locator('.mistake-row>input').first().uncheck(); await toolbar.locator('button').last().click();
    const confirm = page.getByRole('dialog'); await confirm.waitFor(); assert.ok((await confirm.locator('h2').innerText()).includes(String(keys.length - 1)));
    await confirm.locator('button').last().evaluate(node => { node.click(); node.click(); });
    await page.waitForFunction(() => document.querySelectorAll('.mistake-trash .mistake-row').length === 1);
    assert.deepEqual((await client.call('mistakes/trash')).data.trash.map(row => row.key), [retained]);
    await toolbar.screenshot({ path: path.join(output, `large-trash-${language}.png`) });
    await trash.locator('.mistake-row-actions button').nth(1).click(); await page.waitForFunction(() => !document.querySelectorAll('.mistake-trash .mistake-row').length);
    assert.deepEqual((await client.call('mistakes')).data.mistakes, { [retained]: original.mistakes[retained] });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
    report.flows.push({ language, total: keys.length, restored: keys.length - 1, deleted: keys.length - 1, retainedAndRestored: 1, timestampsPreserved: true, doubleSubmitPrevented: true, failedRetry: language === 'eng', passed: true });
    await context.close(); console.log('PASS large trash ' + language);
  }
  assert.ok(report.requests.every(row => row.bytes < 32768)); assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, 'large-trash-browser-report.json'), JSON.stringify(report, null, 2)); await browser.close(); await f.close(); }
