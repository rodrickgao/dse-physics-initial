import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({storageState:'../tmp/exercise-qa-session.json',viewport:{width:1440,height:1000}});
 await context.addInitScript(()=>localStorage.setItem('dse-physics-language-v1','chn'));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5178/#home');
 await page.locator('.home-view .library-card').first().click();await page.locator('.question-bank-options').waitFor();
 assert.equal(await page.locator('.nav-list button').count(),7);
 assert.equal(await page.locator('.nav-list button').filter({hasText:/^题库$/}).count(),1);
 assert.equal(await page.locator('.question-bank-option').count(),2);
 await page.screenshot({path:'../tmp/textbook-exercise-qa/bank-hub.png',fullPage:true});
 await page.locator('.question-bank-option').first().click();await page.locator('.papers-view').waitFor();
 assert.equal(await page.locator('.nav-list button[aria-current="page"]').innerText(),'题库');
 await page.locator('.question-bank-back').click();await page.locator('.question-bank-option').last().click();
 await page.locator('.exercises-view .book-card').first().waitFor();
 assert.equal(await page.locator('.nav-list button[aria-current="page"]').innerText(),'题库');
 await page.goto('http://127.0.0.1:5178/#exercises?question=tb-201-1');await page.locator('[data-exercise][aria-busy="false"]').waitFor();
 assert.equal(await page.locator('.nav-list button[aria-current="page"]').innerText(),'题库');
 await page.locator('.question-bank-back').click();await page.locator('.language-switch').click();
 assert.equal(await page.locator('.question-bank-view h1').innerText(),'Question bank');
 await page.locator('.question-bank-option').last().click();await page.goBack();await page.locator('.question-bank-options').waitFor();
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('.mobile-nav button[aria-current="page"]').innerText(),'Questions');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:'../tmp/textbook-exercise-qa/bank-hub-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: merged home/sidebar/mobile entry, both child banks, return navigation, deep links, English and mobile');
}finally{await browser.close();}
