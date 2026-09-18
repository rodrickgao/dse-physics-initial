import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const email=`password-${Date.now()}@example.com`; const base='http://127.0.0.1:5178';
try {
 await page.goto(base);await page.getByLabel('電郵地址').fill(email);await page.getByRole('button',{name:'取得驗證碼',exact:true}).click();
 await page.locator('input[autocomplete="one-time-code"]').fill(await page.locator('.local-code strong').innerText());await page.getByRole('button',{name:'註冊 / 登入',exact:true}).click();
 await page.locator('#profile-nickname').fill('密碼同學');await page.getByRole('radio',{name:'中五',exact:true}).check();await page.getByRole('radio',{name:'5',exact:true}).check();await page.getByRole('button',{name:'牛頓 · 招手',exact:true}).click();
 await page.getByLabel('新密碼',{exact:true}).fill('Study-pass-123');await page.getByLabel('確認新密碼',{exact:true}).fill('Different-123');await page.getByRole('button',{name:'完成註冊，開始學習'}).click();await page.getByRole('alert').filter({hasText:'兩次輸入'}).waitFor();
 await page.getByLabel('確認新密碼',{exact:true}).fill('Study-pass-123');await page.getByRole('button',{name:'完成註冊，開始學習'}).click();await page.locator('.account-bar').waitFor();await page.getByRole('button',{name:'登出',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:email,exact:true}).click();assert.equal(await page.getByLabel('電郵地址').inputValue(),email);
 await page.getByLabel('登入密碼').fill('Wrong-pass-123');await page.getByRole('button',{name:'使用密碼登入',exact:true}).click();await page.getByRole('alert').waitFor();
 await page.getByLabel('登入密碼').fill('Study-pass-123');await page.getByRole('button',{name:'使用密碼登入',exact:true}).click();await page.locator('.account-bar').waitFor();await page.getByRole('button',{name:'登出',exact:true}).click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 fs.mkdirSync('../tmp/password-browser-qa/screenshots',{recursive:true});await page.screenshot({path:'../tmp/password-browser-qa/screenshots/login-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'../tmp/password-browser-qa/screenshots/login-desktop.png',fullPage:true});
 const stored=await page.evaluate(()=>JSON.stringify(localStorage));assert.ok(!stored.includes('Study-pass-123'));
 await page.getByRole('button',{name:'移除記錄 '+email,exact:true}).click();assert.equal(await page.getByRole('button',{name:email,exact:true}).count(),0);
 const fresh=await browser.newContext();const freshPage=await fresh.newPage();await freshPage.goto(base);assert.equal(await freshPage.getByRole('button',{name:email,exact:true}).count(),0);await fresh.close();assert.deepEqual(errors,[]);
 console.log('PASS: password confirmation, registration, remembered email, password login, removal, browser isolation, mobile and desktop');
} finally {await browser.close();}
