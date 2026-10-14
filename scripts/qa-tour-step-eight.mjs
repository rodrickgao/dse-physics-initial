import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { chromium } from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { fixture } from './deep-test-fixture.mjs';

const output = path.resolve(process.env.DSE_QA_OUTPUT || '../output/tour-step-eight-20261013');
const f = await fixture('tour-step-eight'), browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { views: [], tours: [], errors: [], httpErrors: [] };
let lastPage;
async function contextFor(record, language, width, resume) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width < 1100, reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
  for (const [name, value] of record.client.jar) await context.addCookies([{ name, value, url: f.base, httpOnly: true, sameSite: 'Strict' }]);
  await context.addInitScript(({ id, language, resume }) => {
    try {
      localStorage.setItem('dse-physics-language-v1', language);
      if (resume) localStorage.setItem('ddphysics-tour:v4:' + encodeURIComponent(id), JSON.stringify({ version: 4, status: 'in-progress', lastCompleted: 6, skippedSteps: [], pages: {} }));
    } catch {}
  }, { id: record.user.id, language, resume });
  context.on('page', page => page.on('pageerror', error => report.errors.push(error.message)));
  context.on('response', response => { if (response.status() >= 400) { const url=new URL(response.url()); report.httpErrors.push({ language,width,status:response.status(),route:url.pathname+url.search }); } });
  return context;
}
try {
  const client = f.client(), user = await f.register(client, 'tour-readonly@local.test'), record = { client, user };
  await client.call('mistakes/import', { keys: ['ex-101-1', 'tb-502-1', 'tb-E303-22', 'ex-103-1'] });
  const before = (await client.call('mistakes')).data;
  for (const language of ['chn', 'eng']) for (const width of [1440, 1024, 390, 320]) {
    f.advance(61000);
    const context = await contextFor(record, language, width, true), page = await context.newPage(); lastPage=page;
    await page.goto(f.base);
    await page.getByRole('button', { name: language === 'chn' ? '继续教程' : 'Resume tour', exact: true }).click();
    const panel = page.locator('.tour-panel[data-tour-step="analysis-open"]'), target = page.locator('[data-tour="knowledge-profile"]');
    await panel.waitFor(); await page.locator('[data-tour-blocker]').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-tour="knowledge-profile"]')?.inert);
    assert.ok((await panel.locator('header>span').innerText()).includes('8'));
    assert.equal(await panel.locator('#tour-body strong').innerText(), language === 'chn' ? '点击「下一步」。' : 'Click “Next”.');
    assert.equal(await panel.getAttribute('aria-modal'), 'true');
    const route = page.url();
    const clickTargets = await target.locator('a,button').evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      return { x, y, hit: document.elementFromPoint(x, y)?.closest('[data-tour-blocker]') !== null, visible: x > 0 && x < innerWidth && y > 75 && y < innerHeight - 80 };
    }).filter(row => row.visible && row.hit));
    assert.ok(clickTargets.length >= 1);
    for (const point of clickTargets.slice(0, 3)) {
      if (width < 1100) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
    }
    assert.equal(page.url(), route); assert.equal(await target.locator('[aria-expanded="true"]').count(), 0);
    await panel.focus();
    await target.locator('a').first().evaluate(node => node.focus());
    assert.ok(await panel.evaluate(node => node.contains(document.activeElement)));
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); assert.ok(await panel.evaluate(node => node.contains(document.activeElement))); }
    await page.screenshot({ path: path.join(output, `${language}-${width}.png`) });
    await panel.locator('footer button').last().click();
    const ninth = page.locator('.tour-panel[data-tour-step="analysis-report"]'); await ninth.waitFor();
    assert.equal(await target.evaluate(node => node.inert), false); assert.equal(await page.locator('[data-tour-blocker]').count(), 0);
    await ninth.locator('footer button').first().click(); await panel.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-tour="knowledge-profile"]')?.inert);
    await page.keyboard.press('Escape'); await panel.waitFor({ state: 'hidden' });
    assert.equal(await target.evaluate(node => node.inert), false);
    await page.locator('.home-weak-topic>a').first().click(); await page.waitForURL(/#textbook/);
    assert.deepEqual((await client.call('mistakes')).data, before);
    report.views.push({ language, width, pointerBlocked: true, keyboardBlocked: true, nextEnabled: true, backAndExitRestore: true, normalTopicNavigation: true, passed: true });
    await context.close(); console.log(`PASS ${language} ${width}`);
  }
  for (const language of ['chn', 'eng']) {
    f.advance(61000);
    const client = f.client(), user = await f.register(client, `tour-complete-${language}@local.test`);
    const context = await contextFor({ client, user }, language, language === 'chn' ? 1440 : 390, false), page = await context.newPage();
    await page.goto(f.base); await page.getByRole('button', { name: language === 'chn' ? '开始体验' : 'Start exploring', exact: true }).click();
    for (const [step, target] of [['open', 'example-chapter-101'], ['solution', 'example-solution'], ['mastered', 'mark-mastered'], ['mark', 'mark-mistake'], ['mistake-review', 'tour-mistake-open'], ['question-knowledge', 'question-knowledge'], ['knowledge-question', 'knowledge-question-2']]) {
      await page.locator(`.tour-panel[data-tour-step="${step}"]`).waitFor(); await page.locator(`[data-tour="${target}"]`).filter({ visible: true }).first().click();
    }
    for (const step of ['analysis-open', 'analysis-report', 'replay']) {
      const panel = page.locator(`.tour-panel[data-tour-step="${step}"]`); await panel.waitFor(); await panel.locator('footer button').last().click();
    }
    await page.locator('.tour-panel[data-tour-step="done"]').waitFor();
    const progress = await page.evaluate(id => JSON.parse(localStorage.getItem('ddphysics-tour:v4:' + encodeURIComponent(id))), user.id);
    assert.equal(progress.status, 'completed'); assert.deepEqual(progress.skippedSteps, []);
    report.tours.push({ language, all10Steps: true, passed: true }); await context.close();
  }
  assert.deepEqual(report.errors, []); report.passed = true;
} catch (error) { report.failure = error.stack;if(lastPage&&!lastPage.isClosed()){await lastPage.screenshot({path:path.join(output,'failure.png')});report.failureUrl=lastPage.url();report.failureText=await lastPage.locator('body').innerText();}throw error; }
finally {
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  await browser.close(); await f.close();
  const target = path.resolve(f.directory);
  assert.ok(target.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(target).startsWith('ddphysics-deep-tour-step-eight-'));
  fs.rmSync(target, { recursive: true });
}
