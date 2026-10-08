import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='../tmp/examples-site-qa';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({storageState:'../tmp/exercise-qa-session.json',viewport:{width:1440,height:1000}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('dse-physics-language-v1','chn'));
try {
 await page.goto('http://127.0.0.1:5178/#examples');
 await page.locator('.examples-view .book-card').first().waitFor();
 assert.equal(await page.locator('.examples-view .book-card').count(),9);
 await page.screenshot({path:out+'/books.png',fullPage:true});
 await page.locator('.examples-view .book-card').nth(1).click();
 assert.equal(await page.locator('.exercise-directory>button').count(),10);
 await page.reload();await page.locator('.exercise-directory>button').first().waitFor();
 await page.screenshot({path:out+'/chapters.png',fullPage:true});
 const ids=['ex-101-1','ex-202-4','ex-206-5','ex-3A03-1','ex-3B05-8','ex-401-3','ex-E103-9','ex-E402-7'];
 for(const id of ids){
  await page.evaluate(id=>{location.hash='examples?question='+id;},id);
  await page.locator(`[data-example="${id}"][aria-busy="false"]`).waitFor();
  await page.locator('.stage-toggle').first().click();
  if(await page.locator('.stage-toggle').count()>1)await page.locator('.stage-toggle').nth(1).click();
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.exercise-reader img')].map(i=>i.decode()));});
  const inlineMath=await page.locator('.study-content math:not([display=block])').evaluateAll(nodes=>nodes.map(node=>({x:getComputedStyle(node).overflowX,y:getComputedStyle(node).overflowY})));
  assert.ok(inlineMath.every(style=>style.x==='visible'&&style.y==='visible'),'inline formulas must not create scroll controls');
  const headings=await page.locator('.study-stage>h3').allTextContents();
  assert.match(headings[1],/Textbook solution/);
  assert.ok(await page.locator('.question-content').first().innerText());
  await page.screenshot({path:out+'/'+id+'.png',fullPage:true});
 }
 for(const width of [390,320]){
  await page.evaluate(()=>{location.hash='examples?question=ex-E103-9';});
  await page.locator('[data-example="ex-E103-9"][aria-busy="false"]').waitFor();
  await page.locator('.stage-toggle').first().click();await page.locator('.stage-toggle').nth(1).click();
  await page.setViewportSize({width,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
  await page.screenshot({path:out+'/mobile-'+width+'.png',fullPage:true});
  await page.locator('.mobile-picker').click();await page.locator('#example-navigator button').first().click();
  await page.locator('[data-example][aria-busy="false"]').waitFor();
  assert.equal(await page.locator('.mobile-picker').getAttribute('aria-expanded'),'false');
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('http://127.0.0.1:5178/#bank');await page.locator('#bank-search').fill('bungee');
 await page.locator('.bank-search-result').first().waitFor();
 assert.ok(await page.locator('.bank-search-result').filter({hasText:'206 · Example 6'}).count());
 await page.goto('http://127.0.0.1:5178/#examples?question=ex-3B05-8');
 await page.locator('[data-example][aria-busy="false"]').waitFor();await page.locator('.stage-toggle').first().click();
 const cells=await page.locator('.study-content td').evaluateAll(cells=>cells.map(c=>({width:c.clientWidth,content:c.scrollWidth})));
 assert.ok(cells.every(c=>c.content<=c.width+2),'clipped table cells');
 await page.screenshot({path:out+'/table-final.png',fullPage:true});
 await page.locator('.question-content img').first().focus();await page.keyboard.press('Enter');
 await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');
 await page.locator('.language-switch').click();await page.locator('[data-example][aria-busy="false"]').waitFor();
 assert.ok((await page.locator('.exercise-breadcrumb').innerText()).includes('Compulsory Book 3'));
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/result.json',JSON.stringify({passed:true,samples:ids,viewports:[1440,390,320]},null,2));
 console.log('Examples browser QA passed');
} catch(e){await page.screenshot({path:out+'/failure.png',fullPage:true});throw e;}finally{await browser.close();}
