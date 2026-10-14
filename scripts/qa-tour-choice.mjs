import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { fixture, output } from './deep-test-fixture.mjs';

const f = await fixture('tour-choice'), browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { flows: [], errors: [] };
try {
  const client = f.client(), user = await f.register(client, 'tutorial-choice@local.test');
  await client.call('mistakes/import', { keys: ['ex-101-1'] });
  const before = (await client.call('mistakes')).data;
  for (const language of ['chn', 'eng']) for (const target of ['topic']) {
    f.advance(61000);
    const width = (language === 'chn') === (target === 'topic') ? 1440 : 390;
    const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width === 390, reducedMotion: 'reduce' });
    for (const [name, value] of client.jar) await context.addCookies([{ name, value, url: f.base, httpOnly: true, sameSite: 'Strict' }]);
    await context.addInitScript(({ id, language }) => { try { localStorage.setItem('dse-physics-language-v1', language); localStorage.setItem('ddphysics-tour:v4:' + encodeURIComponent(id), JSON.stringify({ version: 4, status: 'in-progress', lastCompleted: 7, skippedSteps: [], pages: {} })); } catch {} }, { id: user.id, language });
    const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(f.base + '#home'); await page.getByRole('button', { name: language === 'chn' ? '继续教程' : 'Resume tour', exact: true }).click();
    const ninth = page.locator('.tour-panel[data-tour-step="analysis-report"]'), last = page.locator('.tour-panel[data-tour-step="replay"]');
    await ninth.waitFor(); assert.ok(page.url().includes('#home'));
    const link = page.locator(target === 'topic' ? '.home-weak-topic>a' : '[data-topic-practice]').first();
    if (target === 'topic') { await link.focus(); await page.keyboard.press('Enter'); }
    else if (width === 390) await link.tap(); else await link.click();
    await last.waitFor();
    if (target === 'topic') { assert.ok(page.url().includes('#textbook')); await page.locator('[data-study-knowledge-card]').first().waitFor(); }
    else { assert.ok(page.url().includes('#exercises')); await page.locator('[data-exercise][aria-busy="false"]').waitFor(); }
    await page.screenshot({ path: path.join(output, `tour-choice-${language}-${target}.png`) });
    await last.locator('footer button').first().click(); await ninth.waitFor(); assert.ok(page.url().includes('#mistakes'));
    await page.locator('.student-topic-title').first().waitFor();
    await ninth.locator('footer button').last().click(); await last.waitFor();
    await last.locator('footer button').last().click(); await page.locator('.tour-panel[data-tour-step="done"]').waitFor();
    const saved = await page.evaluate(id => JSON.parse(localStorage.getItem('ddphysics-tour:v4:' + encodeURIComponent(id))), user.id);
    assert.equal(saved.status, 'completed'); assert.deepEqual(saved.skippedSteps, []);
    assert.deepEqual((await client.call('mistakes')).data, before);
    report.flows.push({ language, target, width, keyboardOrTouch: true, autoAdvances: true, backReturnsHome: true, directNextStillWorks: true, completedWithoutSkips: true, marksPreserved: true, passed: true });
    await context.close(); console.log(`PASS ${language} ${target}`);
  }
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.failure = error.stack; throw error; }
finally { fs.writeFileSync(path.join(output, 'tour-choice-browser-report.json'), JSON.stringify(report, null, 2)); await browser.close(); await f.close(); }
