import { chromium } from 'playwright';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/');await page.getByRole('heading',{name:'欢迎回来'}).waitFor();
 assert.equal(await page.getByText('资料使用说明').count(),0);assert.equal(await page.getByRole('link',{name:'管理后台 ↗'}).count(),0);
 await page.getByRole('button',{name:'密码登录',exact:true}).click();await page.getByLabel('登录密码',{exact:true}).fill('Test-only-password');
 await page.getByRole('button',{name:'验证码登录 / 注册',exact:true}).click();await page.getByPlaceholder('000000').fill('123456');
 mkdirSync('../tmp/login-design',{recursive:true});await page.screenshot({path:'../tmp/login-design/desktop.png',fullPage:true,timeout:20000});
 const before=await page.locator('.grade-stream-row').first().evaluate(e=>getComputedStyle(e).transform);await page.waitForTimeout(500);const after=await page.locator('.grade-stream-row').first().evaluate(e=>getComputedStyle(e).transform);assert.notEqual(before,after);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'../tmp/login-design/mobile.png',fullPage:true,timeout:20000});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.grade-stream-row').first().evaluate(e=>getComputedStyle(e).animationName),'none');assert.deepEqual(errors,[]);console.log('Login layout and interactions PASS');
}finally{await browser.close();}
