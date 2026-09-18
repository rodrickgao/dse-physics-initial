import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const errors=[];
try {
 for(const width of [1400,390]) for(const reduced of [false,true]) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:reduced?'reduce':'no-preference'});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.motionCalls=[];
   const animate=Element.prototype.animate;
   Element.prototype.animate=function(frames,options){window.motionCalls.push({className:this.className,options});return animate.call(this,frames,options);};
  });
  await page.goto('http://127.0.0.1:5177/#textbook');
  await page.locator('.book-card').first().click();
  await page.locator('.knowledge-browser-content').waitFor();
  await page.locator('.chapter-list button').nth(2).click();
  assert.equal(await page.locator('.knowledge-point-head span').first().textContent(),'1.2.1');
  await page.locator('.chapter-list').evaluate(el=>{el.children[3].click();});
  await page.waitForTimeout(35);
  await page.locator('.chapter-list').evaluate(el=>{el.children[1].click();});
  await page.waitForTimeout(280);
  assert.equal(await page.locator('.knowledge-point-head span').first().textContent(),'1.1.1');
  assert.equal(await page.locator('.knowledge-browser-content').evaluate(el=>getComputedStyle(el).opacity),'1');
  const input=page.locator('.knowledge-search-wrap input');
  await input.fill('E1.1.1');
  await page.waitForTimeout(260);
  assert.ok(await input.evaluate(el=>el===document.activeElement));
  assert.equal(await page.locator('.knowledge-point-head span').first().textContent(),'E1.1.1');
  await input.fill('');
  await page.locator('.back-books').click();
  assert.equal(await page.locator('.book-card').count(),9);
  const calls=await page.evaluate(()=>window.motionCalls);
  assert.equal(calls.length===0,reduced);
  if(!reduced) assert.ok(calls.some(c=>c.className==='knowledge-browser-content'));
  if(reduced) assert.equal(await page.locator('.page-enter').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: desktop/mobile transitions, chapters, fast switching, input focus, return navigation and reduced motion.');
}finally{await browser.close();}
