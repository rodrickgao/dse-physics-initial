import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { fixture } from './deep-test-fixture.mjs';

const repeatOnly = process.env.DSE_WELCOME_REPEAT_ONLY === '1';
const output = path.resolve(process.env.DSE_QA_OUTPUT || (repeatOnly ? '../output/welcome-repeat-20261012' : '../output/welcome-flow-20261012'));
fs.mkdirSync(output, { recursive: true });
const f = await fixture('welcome-flow');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { views: [], flows: [], timing: [], errors: [], isolatedDirectory: f.directory };
const viewports = [
  { width: 1440, height: 900 },
  { width: 1180, height: 820 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
];
async function contextFor(language, viewport, options = {}) {
  const context = await browser.newContext({ viewport, ...options });
  await context.addInitScript(language => {
    localStorage.setItem('dse-physics-language-v1', language);
    const observer = new MutationObserver(() => {
      if (document.querySelector('.welcome-page') && !window.welcomeStarted) window.welcomeStarted = performance.now();
      if (document.querySelector('.welcome-actions') && !window.choicesAppeared) window.choicesAppeared = performance.now();
    });
    observer.observe(document, { childList: true, subtree: true });
  }, language);
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(f.base);
  return { context, page };
}
async function settled(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})));
  });
}
async function fixedLanguage(page) {
  const button = page.locator('.language-switch');
  const before = await button.boundingBox();
  assert.equal(await button.evaluate(node => node.parentElement === document.body), true);
  assert.equal(await button.evaluate(node => getComputedStyle(node).position), 'fixed');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const after = await button.boundingBox();
  assert.ok(Math.abs(before.x - after.x) < 1 && Math.abs(before.y - after.y) < 1, JSON.stringify({ before, after }));
  assert.ok(after.y >= 0 && after.y < 24);
  await page.evaluate(() => window.scrollTo(0, 0));
}
async function layout(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  const boxes = await page.locator('.login-brand-stage,.auth-card').evaluateAll(nodes => nodes.map(node => ({ class: node.className, top: node.getBoundingClientRect().top, height: node.getBoundingClientRect().height, padding: getComputedStyle(node.parentElement).padding, scroll: scrollY })));
  if (!boxes.every(box => box.top >= 65)) await page.screenshot({ path: path.join(output, 'failure-layout.png'), fullPage: true });
  assert.equal(boxes.every(box => box.top >= 65), true, JSON.stringify(boxes));
  await fixedLanguage(page);
}
try {
  for (const language of ['chn', 'eng']) {
    for (const viewport of repeatOnly ? viewports.filter(v => [1440, 390].includes(v.width)) : viewports) {
      const { context, page } = await contextFor(language, viewport);
      const tag = `${language}-${viewport.width}x${viewport.height}`;
      await page.locator('.welcome-page').waitFor();
      assert.equal(await page.locator('.login-brand-highlights li').count(), 4);
      assert.equal(await page.locator('.auth-card').count(), 0);
      assert.equal(await page.locator('.welcome-actions').count(), 0);
      if (viewport.width === 1440) {
        await page.waitForTimeout(2000);
        assert.equal(await page.locator('.welcome-actions').count(), 0);
      }
      await page.locator('.welcome-actions').waitFor();
      const duration = await page.evaluate(() => window.choicesAppeared - window.welcomeStarted);
      assert.ok(duration >= 2950 && duration < 3600, `Welcome timing: ${duration}`);
      report.timing.push({ tag, milliseconds: duration });
      await settled(page);
      await layout(page);
      await page.screenshot({ path: path.join(output, `welcome-${tag}.png`), fullPage: true });
      await page.locator('.welcome-actions button').first().click();
      await page.locator('.login-form-page').waitFor();
      assert.equal(await page.locator('.login-brand-highlights').count(), 0);
      assert.equal(await page.locator('input[type=email]').count(), 1);
      assert.equal(await page.locator('input[autocomplete=one-time-code]').count(), 1);
      assert.equal(await page.locator('.login-methods button').count(), 2);
      assert.equal(await page.locator('.login-form-heading h2').evaluate(node => node === document.activeElement), true);
      await page.locator('.login-methods button').first().click();
      await page.locator('input[type=password]').fill('temporary-field-check');
      await page.locator('#login-email').fill('preserved@local.test');
      await page.locator('.language-switch').click();
      assert.equal(await page.locator('#login-email').inputValue(), 'preserved@local.test');
      assert.equal(await page.locator('input[type=password]').inputValue(), 'temporary-field-check');
      await page.locator('.language-switch').click();
      await page.locator('.login-methods button').last().click();
      await settled(page);
      await layout(page);
      await page.screenshot({ path: path.join(output, `login-${tag}.png`), fullPage: true });
      await page.locator('.auth-account-switch').click();
      assert.equal(await page.locator('.login-brand-highlights').count(), 0);
      assert.equal(await page.locator('.login-methods').count(), 0);
      assert.equal(await page.locator('input[autocomplete=one-time-code]').count(), 1);
      await settled(page);
      await layout(page);
      await page.screenshot({ path: path.join(output, `register-${tag}.png`), fullPage: true });
      await page.reload();
      await page.locator('.welcome-page').waitFor();
      assert.equal(await page.locator('.auth-card').count(), 0);
      assert.equal(await page.locator('.welcome-actions').count(), 0);
      await page.locator('.welcome-actions').waitFor();
      const repeatDuration = await page.evaluate(() => window.choicesAppeared - window.welcomeStarted);
      assert.ok(repeatDuration >= 2950 && repeatDuration < 3600, `Repeat welcome timing: ${repeatDuration}`);
      report.timing.push({ tag: `${tag}-reload`, milliseconds: repeatDuration });
      await fixedLanguage(page);
      report.views.push({ language, ...viewport, welcome: true, login: true, register: true, fixedLanguage: true, returningVisitorWelcome: true });
      await context.close();
      console.log(`Passed ${tag}`);
    }
  }
  // Reduced motion reveals both choices immediately, without a forced wait.
  {
    const { context, page } = await contextFor('eng', { width: 390, height: 844 }, { reducedMotion: 'reduce' });
    await page.locator('.welcome-actions').waitFor();
    assert.ok(await page.evaluate(() => window.choicesAppeared - window.welcomeStarted < 500));
    assert.equal(await page.locator('.login-logo-chinese').evaluate(node => getComputedStyle(node).animationName), 'none');
    await page.locator('.welcome-actions button').last().click();
    await page.getByRole('heading', { name: 'Sign up to ddphysics' }).waitFor();
    assert.equal(await page.locator('.login-brand-highlights').count(), 0);
    report.flows.push('Reduced motion and direct welcome-to-register');
    await context.close();
  }
  // Saved accounts and the old welcome-seen flag must also start at the welcome page.
  {
    const { context, page } = await contextFor('chn', { width: 1440, height: 900 });
    await page.evaluate(() => {
      localStorage.setItem('dse-remembered-emails-v1', JSON.stringify(['saved@local.test']));
      localStorage.setItem('dse-welcome-seen-v1', 'true');
    });
    await page.reload();
    await page.locator('.welcome-page').waitFor();
    assert.equal(await page.locator('.auth-card').count(), 0);
    await page.locator('.welcome-actions button').first().click();
    await page.locator('.login-form-page').waitFor();
    await page.locator('#login-email').focus();
    await page.locator('.remembered-email').click();
    assert.equal(await page.locator('#login-email').inputValue(), 'saved@local.test');
    report.flows.push('Saved accounts and old welcome flag still show welcome; account suggestions work');
    await context.close();
  }
  // Real registration, email-code sign in, password sign in, and failed-password feedback use isolated data.
  {
    const { context, page } = await contextFor('chn', { width: 390, height: 844 }, { reducedMotion: 'reduce' });
    await page.locator('.welcome-actions button').last().click();
    const email = 'welcome-flow@local.test';
    await page.locator('#login-email').fill(email);
    await page.locator('.auth-code button').click();
    const code = page.locator('.local-code strong');
    await code.waitFor();
    await page.getByPlaceholder('000000').fill((await code.innerText()).trim());
    await page.locator('.auth-submit').click();
    await page.locator('.profile-page').waitFor();
    assert.equal((await (await context.request.get(f.base + 'api/auth/session')).json()).user.email, email);
    let response = await context.request.put(f.base + 'api/profile', { data: { nickname: '欢迎页测试', grade: '中五', target: '5*', region: 'hong-kong', password: 'Welcome-flow-123', confirmPassword: 'Welcome-flow-123' } });
    assert.equal(response.status(), 200, await response.text());
    await context.request.post(f.base + 'api/auth/logout', { data: {} });
    await page.reload();
    await page.locator('.welcome-page').waitFor();
    await page.locator('.welcome-actions button').first().click();
    await page.locator('.login-form-page').waitFor();
    await page.locator('#login-email').fill(email);
    await page.locator('.login-methods button').first().click();
    await page.locator('input[type=password]').fill('Wrong-password-123');
    await page.locator('.auth-submit').click();
    await page.locator('.account-error').waitFor();
    await page.locator('input[type=password]').fill('Welcome-flow-123');
    await page.locator('.auth-submit').click();
    await page.locator('.app-shell').waitFor();
    await fixedLanguage(page);
    await page.keyboard.press('Escape');
    await page.locator('.language-switch').click();
    await page.locator('.account-settings').click();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('.profile-logout').click();
    await page.locator('.welcome-page').waitFor();
    await page.waitForFunction(() => scrollY === 0);
    assert.equal(await page.locator('.app-shell').count(), 0);
    await page.locator('.welcome-actions button').first().click();
    await page.locator('.login-form-page').waitFor();
    await page.locator('#login-email').fill(email);
    await page.locator('.auth-code button').click();
    await code.waitFor();
    await page.getByPlaceholder('000000').fill((await code.innerText()).trim());
    await page.locator('.auth-submit').click();
    await page.locator('.app-shell').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.account-settings').click();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('.profile-logout').click();
    await page.locator('.welcome-page').waitFor();
    await page.waitForFunction(() => scrollY === 0);
    assert.equal(await page.locator('.auth-card').count(), 0);
    assert.equal((await (await context.request.get(f.base + 'api/auth/session')).json()).user, null);
    await page.locator('.language-switch').click();
    await page.locator('.welcome-actions button').last().click();
    await page.getByRole('heading', { name: '注册 ddphysics' }).waitFor();
    assert.equal(await page.locator('.login-brand-highlights').count(), 0);
    report.flows.push('Registration, password failure/retry, email-code sign in and two actual logout-to-welcome cycles');
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  await f.close();
}
console.log(JSON.stringify({ views: report.views.length, flows: report.flows.length, passed: report.passed }));
