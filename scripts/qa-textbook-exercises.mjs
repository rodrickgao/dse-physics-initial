import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base='http://127.0.0.1:5178';
const output='../tmp/textbook-exercise-qa';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({storageState:'../tmp/exercise-qa-session.json',viewport:{width:1440,height:1000}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const index=JSON.parse(fs.readFileSync('assets/textbook-exercises/index-eng.json','utf8'));
async function ready(){
  await page.locator('.study-flow[data-exercise][aria-busy="false"]').waitFor();
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.exercise-reader img')].map(i=>i.decode()));});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
}
try {
  await page.addInitScript(()=>localStorage.setItem('dse-physics-language-v1','chn'));
  await page.goto(base+'/#exercises');await page.locator('.exercises-view .book-card').first().waitFor();
  assert.equal(await page.locator('.exercises-view .book-card').count(),9);
  await page.screenshot({path:output+'/books.png',fullPage:true});
  await page.locator('.exercises-view .book-card').first().click();
  assert.equal(await page.locator('.exercise-directory>button').count(),5);
  await page.locator('.exercise-directory>button').first().click();
  await ready();
  assert.equal(await page.locator('.official-content').count(),0);
  await page.locator('.stage-toggle').first().click();await page.locator('.official-content').waitFor();
  await page.locator('.exercise-knowledge button').first().click();
  await page.locator('.related-textbook-exercises button').first().waitFor();
  const order=await page.locator('.knowledge-point-card').first().evaluate(card=>{
    const blocks=[...card.querySelectorAll('.knowledge-questions')];
    return {past:blocks.findIndex(b=>b.classList.contains('related-past-questions')),exercises:blocks.findIndex(b=>b.classList.contains('related-textbook-exercises'))};
  });assert.ok(order.past>=0&&order.exercises>order.past);
  await page.screenshot({path:output+'/knowledge-links.png',fullPage:true});
  await page.locator('.related-textbook-exercises button').first().click();await ready();
  for(const lang of ['chn','eng']) {
    if(lang==='eng')await page.locator('.language-switch').click();
    for(const book of index.books){
      const id=book.chapters[0].sections[0].questionIds[0];
      await page.evaluate(id=>{location.hash='exercises?question='+id;},id);await page.locator(`[data-exercise="${id}"][aria-busy="false"]`).waitFor();await ready();
      await page.locator('.stage-toggle').first().click();await page.locator('.official-content').waitFor();
      assert.ok((await page.locator('.question-content').innerText()).length>10);
    }
  }
  for(const id of ['tb-105-20','tb-503-13','tb-3A03-8']) {
    await page.evaluate(id=>{location.hash='exercises?question='+id;},id);await page.locator(`[data-exercise="${id}"][aria-busy="false"]`).waitFor();await ready();
    await page.locator('.stage-toggle').first().click();
    if(await page.locator('.stage-toggle').count()>1)await page.locator('.stage-toggle').nth(1).click();
    await page.screenshot({path:output+'/'+id+'.png',fullPage:true});
  }
  await page.locator('.language-switch').click();await ready();
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});await ready();
    await page.locator('.exercise-workspace .mobile-picker').click();
    await page.locator('#exercise-navigator .question-chip-grid button').first().click();await ready();
    assert.equal(await page.locator('.exercise-workspace .mobile-picker').getAttribute('aria-expanded'),'false');
    await page.screenshot({path:output+'/question-'+width+'.png',fullPage:true});
  }
  await page.locator('.exercise-breadcrumb button').first().click();await page.locator('.exercises-view .book-card').first().waitFor();
  await page.screenshot({path:output+'/books-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('.exercises-view .book-card').nth(1).click();
  await page.locator('.exercise-directory>button').first().click();
  const expected=index.questions.filter(q=>q.chapter==='201').sort((a,b)=>Number(a.number)-Number(b.number));
  assert.deepEqual(await page.locator('#exercise-navigator .question-chip-grid button').allTextContents(),expected.map(q=>`Q${q.number}`));
  await ready();
  assert.equal(await page.locator('[data-exercise]').getAttribute('data-exercise'),expected[0].id);
  const navBox=await page.locator('#exercise-navigator').boundingBox();
  const readerBox=await page.locator('.exercise-reader').boundingBox();
  assert.ok(navBox.x+navBox.width<=readerBox.x,'directory must be left of question');
  assert.equal(await page.locator('#exercise-navigator .paper-choice-list').count(),0);
  await page.locator('#exercise-navigator .question-chip-grid button').last().click();await ready();
  assert.equal(await page.locator('[data-exercise]').getAttribute('data-exercise'),expected.at(-1).id);
  await page.locator('#exercise-navigator .question-chip-grid button').first().click();await ready();
  await page.screenshot({path:output+'/chapter-201.png',fullPage:true});
  await ready();
  await page.locator('.exercise-paging button').last().click();await ready();
  assert.equal(await page.locator('[data-exercise]').getAttribute('data-exercise'),expected[1].id);
  const typography=()=>{const p=document.querySelector('.question-content p');const s=getComputedStyle(p);return [s.fontFamily,s.fontSize,s.lineHeight,s.fontWeight,s.fontStyle];};
  const exerciseType=await page.evaluate(typography);
  assert.equal(await page.locator('.question-content b').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).fontWeight==='400')),true);
  assert.equal(await page.locator('.question-content i').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).fontStyle==='normal')),true);
  await page.screenshot({path:output+'/chapter-question.png',fullPage:true});
  await page.goto(base+'/#papers?question=2012%7Cpaper-1a%7C1');
  await page.locator('.study-flow[aria-busy="false"] .question-content p').first().waitFor();
  assert.deepEqual(await page.evaluate(typography),exerciseType);
  assert.deepEqual(errors,[]);console.log('PASS: 9 books, 46 chapters, bilingual readers, answer hiding, independent knowledge links, desktop/mobile, formula samples');
} finally {await browser.close();}

