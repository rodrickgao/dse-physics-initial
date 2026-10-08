import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext({storageState:'../tmp/exercise-qa-session.json',viewport:{width:1440,height:1100}});
 const page=await context.newPage();await page.addInitScript(()=>localStorage.setItem('dse-physics-language-v1','chn'));
 await page.goto('http://127.0.0.1:5178/#exercises?question=tb-201-12');
 await page.locator('[data-exercise][aria-busy="false"]').waitFor();await page.locator('.stage-toggle').first().click();
 await page.locator('.official-content math').first().waitFor();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1100});
  const metrics=await page.locator('.official-content math').evaluateAll(nodes=>nodes.map(n=>({overflow:getComputedStyle(n).overflow,text:n.textContent,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));
  assert.equal(metrics.length,2);for(const m of metrics){assert.equal(m.overflow,'visible');assert.ok(m.height>10&&m.width>0);}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.setViewportSize({width:1440,height:1100});await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('.official-content').screenshot({path:'../tmp/textbook-exercise-qa/formula-fractions.png'});
 console.log('PASS: both fractions render without scroll controls on desktop/mobile');
} finally {await browser.close();}
