import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Run against a separate local service with DSE_DATA_DIR pointing to a QA folder.
const base = process.env.QA_BASE || 'http://127.0.0.1:5178';
const directory = process.env.QA_DATA_DIR || '../tmp/backend-browser-qa';
const out = resolve('../tmp/backend-browser-qa/screenshots'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));
const email = `qa-${Date.now()}@example.com`;
async function login(address) {
  await page.getByLabel('電郵地址').fill(address);
  await page.getByRole('button', { name: '取得驗證碼', exact: true }).click();
  const code = await page.locator('.local-code strong').innerText();
  await page.locator('input[autocomplete="one-time-code"]').fill(code);
  await page.getByRole('button', { name: '註冊 / 登入', exact: true }).click();
  await page.locator('.account-bar,.profile-page').first().waitFor();
  if (await page.locator('.profile-page').count()) {
    await page.locator('#profile-nickname').fill('QA student');
    await page.getByLabel('新密碼', { exact: true }).fill('Study-pass-123');
    await page.getByLabel('確認新密碼', { exact: true }).fill('Study-pass-123');
    await page.getByRole('radio',{name:'中五',exact:true}).check();
    await page.getByRole('radio',{name:'5*',exact:true}).check();
    await page.getByRole('button',{name:'牛頓 · 招手',exact:true}).click();
    await page.getByRole('button',{name:'完成註冊，開始學習',exact:true}).click();
  }
  await page.locator('.account-bar').waitFor();
}
try {
  await page.goto(base); await page.locator('.auth-card').waitFor();
  await page.screenshot({ path: `${out}/login-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/login-mobile.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(email);
  await page.goto(`${base}/#papers?question=${encodeURIComponent('2025|paper-1a|7')}`);
  await page.getByRole('button', { name: '加入錯題', exact: true }).click();
  await page.getByRole('button', { name: '已加入錯題', exact: true }).waitFor();
  assert.equal(Object.keys((await (await context.request.get(`${base}/api/mistakes`)).json()).mistakes).length, 1);
  await page.reload(); await page.locator('.account-bar').waitFor();
  assert.equal((await (await context.request.get(base+'/api/auth/session')).json()).user.email,email);
  await page.locator('.sidebar .nav-list button').nth(3).click();
  await page.locator('.mistake-row').waitFor();
  assert.equal(await page.locator('.mistake-row').count(), 1);
  await page.screenshot({ path: `${out}/student-mistakes.png`, fullPage: true });
  assert.equal((await context.request.get(`${base}/api/admin/stats`)).status(), 403);
  await page.getByRole('button', { name: '登出', exact: true }).click();
  await login(`other-${Date.now()}@example.com`);
  await page.locator('.sidebar .nav-list button').nth(3).click();
  await page.getByText('錯題庫還是空的', { exact: true }).waitFor();
  await page.getByRole('button', { name: '登出', exact: true }).click();
  await page.getByRole('button', { name: '開發者入口', exact: true }).click();
  await page.getByLabel('開發者密鑰').fill(readFileSync(resolve(directory, 'admin-key.txt'), 'utf8').trim());
  await page.getByRole('button', { name: '進入統計後台', exact: true }).click();
  await page.locator('.admin-table').waitFor();
  await page.getByLabel('搜尋學生電郵').fill(email);
  await page.getByRole('button', { name: '查看錯題', exact: true }).click();
  await page.locator('.student-detail').waitFor();
  assert.match(await page.locator('.student-detail').innerText(), /2025 · 1A/);
  assert.ok(await page.locator('.knowledge-tags button').count() > 0);
  await page.screenshot({ path: `${out}/admin-desktop.png`, fullPage: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出全部資料 Excel', exact: true }).click();
  const download = await downloadPromise; assert.equal(download.suggestedFilename(), '學生完整學習資料.xlsx');
  await page.getByRole('button', { name: '知識點', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/admin-mobile.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const path of ['/.local/admin-key.txt', '/server/api.mjs', '/.env.local']) {
    const response = await context.request.get(base + path);
    assert.ok([403, 404].includes(response.status()), `${path} must not be served: ${response.status()}`);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, email, screenshots: out, flows: ['local OTP registration', 'mistake persistence', 'reload login', 'account isolation', 'admin authorization', 'student detail', 'knowledge mapping', 'CSV export', 'mobile layout', 'secret file protection'] }, null, 2));
} finally { await browser.close(); }
