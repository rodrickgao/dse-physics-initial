import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';
const output=path.resolve('../output/free-site-20261014');
const f=await fixture('free-welcome'),browser=await chromium.launch({channel:'chrome',headless:true});
const views=[];
try{
 for(const language of ['chn','eng'])for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.addInitScript(language=>localStorage.setItem('dse-physics-language-v1',language),language);
  const page=await context.newPage();await page.goto(f.base);await page.locator('.welcome-actions button').last().waitFor();
  await page.waitForTimeout(450);assert.match(await page.locator('body').innerText(),language==='eng'?/All features are free/:/全部功能免费/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await page.screenshot({path:path.join(output,`login-${language}-${width}.png`),fullPage:true});views.push({language,width,passed:true});await context.close();
 }
 fs.writeFileSync(path.join(output,'welcome-visual-report.json'),JSON.stringify({views,passed:true},null,2));
}finally{await browser.close();await f.close();}
