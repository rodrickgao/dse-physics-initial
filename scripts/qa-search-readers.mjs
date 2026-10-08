import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='../tmp/search-reader-qa';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({storageState:'../tmp/exercise-qa-session.json',viewport:{width:1440,height:1000}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('dse-physics-language-v1','chn'));
const report=[];
try{
 await page.goto('http://127.0.0.1:5178/#bank');
 await page.locator('#bank-search').waitFor();
 await page.screenshot({path:out+'/directory.png',fullPage:true});
 for(const q of ['想练从速度时间图求加速度的题','比较并联电路中灯泡亮度的题','用动量守恒解碰撞问题','202例4']){
  const start=Date.now();await page.locator('#bank-search').fill(q);
  await page.waitForFunction(()=>document.querySelector('.bank-search-results')?.getAttribute('aria-busy')==='false',{},{timeout:90000});
  await page.locator('.bank-search-result').first().waitFor();
  report.push({q,time:Date.now()-start,results:await page.locator('.bank-search-result').allTextContents()});
 }
 assert.match(report.at(-1).results[0],/202 · Example 4/);
 await page.locator('.bank-search-result').first().click();
 await page.locator('[data-example="ex-202-4"][aria-busy="false"]').waitFor();
 assert.equal(await page.locator('.stage-toggle').first().getAttribute('aria-expanded'),'false');
 await page.locator('.reader-bookmark').click();
 await page.locator('.stage-toggle').first().click();
 await page.locator('.study-content img').first().focus();await page.keyboard.press('Enter');await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');
 await page.screenshot({path:out+'/example.png',fullPage:true});
 await page.locator('.search-return').click();
 await page.locator('.bank-search-result').first().waitFor();
 assert.equal(await page.locator('#bank-search').inputValue(),'202例4');
 await page.locator('#bank-search').fill('想练从速度时间图求加速度的题');
 await page.waitForFunction(()=>document.querySelector('.bank-search-results')?.getAttribute('aria-busy')==='false');
 await page.locator('.bank-search-result').first().waitFor();
 assert.ok(await page.locator('.bank-search-result').count());
 await page.screenshot({path:out+'/knowledge-search.png',fullPage:true});
 await page.locator('.bank-search-result').filter({has:page.locator('.search-source',{hasText:'知识点'})}).first().click();
 await page.locator('.search-return').waitFor();
 await page.locator('.search-return').click();
 await page.locator('.bank-search-result').first().waitFor();
 assert.equal(await page.locator('#bank-search').inputValue(),'想练从速度时间图求加速度的题');
 for(const id of ['ex-101-1','tb-202-1','2025|paper-1a|1']){
  const source=id.startsWith('ex-')?'examples':id.startsWith('tb-')?'exercises':'papers';
  await page.goto(`http://127.0.0.1:5178/#${source}?question=${encodeURIComponent(id)}`);
  await page.locator('.study-flow[aria-busy=false]').waitFor();
  await page.locator('.stage-toggle').first().click();
  assert.match(await page.locator('.stage-toggle').first().innerText(),/收起解答/);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal page overflow '+id);
  await page.screenshot({path:out+'/'+source+'-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/result.json',JSON.stringify({passed:true,report},null,2));console.log(JSON.stringify(report.map(r=>({q:r.q,time:r.time,top:r.results.slice(0,3)})),null,2));
}finally{fs.writeFileSync(out+'/ranking.json',JSON.stringify(report,null,2));await browser.close();}
