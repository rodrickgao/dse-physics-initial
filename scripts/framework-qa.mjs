import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STUDY_CSS} from '../src/lib/study-content.js';

const base = process.env.QA_BASE || 'http://127.0.0.1:5173/';
const out = process.env.QA_OUTPUT || '../tmp/framework-qa';
fs.mkdirSync(out,{recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:"reduce"});
await context.addInitScript(() => { window.print=()=>{window.printCalled=true;}; });
const page = await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const questionUrl = key => `${base}#papers?question=${encodeURIComponent(key)}`;
async function open(key) {
  await page.goto(questionUrl(key));
  await page.locator(`.study-flow[data-question="${key}"] .question-content`).waitFor();
  assert.equal(await page.locator('#official-stage').count(),0);
  assert.equal(await page.locator('#reasoning-stage').count(),0);
}
await open('2024|paper-2|4.S');
await page.reload();
await page.locator('.study-flow[data-question="2024|paper-2|4.S"] .question-content').waitFor();
await page.locator('.sidebar .nav-list button').nth(2).click();
await page.goBack();
await page.locator('.study-flow[data-question="2024|paper-2|4.S"] .question-content').waitFor();
await page.keyboard.press('Control+k');
assert.equal(await page.locator('#paper-search').evaluate(e=>e===document.activeElement),true);
await page.locator('#paper-search').fill('2024');
assert.match(await page.locator('.search-results-heading').innerText(),/30\s*\/\s*\d+/);
await page.getByRole('button',{name:'Clear',exact:true}).click();
await page.getByRole('button',{name:'加入錯題',exact:true}).click();
await open('2025|paper-1a|7');
await page.getByRole('button',{name:'加入錯題',exact:true}).click();
await page.getByRole('button',{name:'2. 展開考評局官方解答',exact:true}).click();
await page.getByRole('button',{name:'3. 展開詳細思路解答',exact:true}).click();
assert.equal(await page.locator('.official-content').evaluate(e=>getComputedStyle(e).color),'rgb(255, 0, 0)');
assert.equal(await page.locator('.reasoning-content').evaluate(e=>getComputedStyle(e).color),'rgb(0, 0, 255)');
await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
await page.screenshot({animations:'disabled',path:`${out}/desktop-worked.png`,fullPage:true});
await page.getByRole('button',{name:'收起解答',exact:true}).click();
assert.equal(await page.locator('#reasoning-stage').count(),0);
await page.setViewportSize({width:390,height:844});
assert.equal(await page.locator('.paper-navigator').isVisible(),false);
await page.locator('.mobile-picker').click();
assert.equal(await page.locator('.paper-navigator').isVisible(),true);
await page.locator('.question-chip-grid button').filter({hasText:/^Q8$/}).click();
assert.equal(await page.locator('.paper-navigator').isVisible(),false);
await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
await page.screenshot({animations:'disabled',path:`${out}/mobile-question.png`,fullPage:true});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
await page.locator('.mobile-nav button').nth(3).click();
await page.getByRole('checkbox',{name:'選取全部題目',exact:true}).uncheck();
assert.equal(await page.getByRole('button',{name:'詳解版 PDF',exact:true}).isDisabled(),true);
await page.locator('.mistake-select').first().check();
await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
await page.screenshot({animations:'disabled',path:`${out}/mobile-mistakes.png`,fullPage:true});
for (const name of ['詳解版 PDF','原題版 PDF']) {
  const popupReady=page.waitForEvent('popup');
  await page.getByRole('button',{name,exact:true}).click();
  const popup=await popupReady;await popup.waitForFunction(()=>window.printCalled===true);
  assert.equal(await popup.locator('.print-question').count(),1);
  assert.equal(await popup.locator('.reasoning-content').count(),name==='詳解版 PDF'?1:0);
  assert.equal(await popup.locator('.working-space').count(),name==='原題版 PDF'?1:0);
  await popup.close();
}
await page.setViewportSize({width:1440,height:1000});
await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
await page.screenshot({animations:'disabled',path:`${out}/desktop-mistakes.png`,fullPage:true});
await page.locator('.sidebar .nav-list button').first().click();
assert.match(await page.locator('.library-card').first().innerText(),/2015–2025/);
await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
await page.screenshot({animations:'disabled',path:`${out}/home.png`,fullPage:true});
await page.getByRole('button',{name:'開始做題',exact:true}).click();
await page.locator('.question-content').waitFor();
assert.ok(Number(decodeURIComponent(new URL(page.url()).hash).match(/question=(\d+)/)[1])>=2015);

// Recover a real failed fetch, rather than silently showing a partial answer.
const failed=await context.newPage();
await failed.route('**/text-papers/2023-chn.json',r=>r.abort());
await failed.goto(questionUrl('2023|paper-1b|1'));
await failed.getByRole('button',{name:'重新載入',exact:true}).waitFor();
assert.equal(await failed.getByRole('button',{name:'2. 展開考評局官方解答',exact:true}).isDisabled(),true);
await failed.unroute('**/text-papers/2023-chn.json');
await failed.getByRole('button',{name:'重新載入',exact:true}).click();
await failed.locator('.question-content').waitFor();await failed.close();

// Every published 2015–2025 edition: both viewport widths, all three fields,
// loaded image assets, and containment. This is a layout audit, not a physics re-mark.
if (process.argv.includes('--flows-only')) {
  assert.deepEqual(errors,[]); await browser.close();
  console.log('PASS: live framework, navigation, saved position, search, mobile controls, sequential reveal, selected print editions and retry.');
  process.exit(0);
}
const layout=await context.newPage();
const problems=[];let editions=0;let imageCount=0;
for (const lang of ['eng','chn']) for (let year=2015;year<=2025;year++) {
  const records=JSON.parse(fs.readFileSync(`text-papers/${year}-${lang}.json`));
  const content=Object.entries(records).map(([key,r])=>`<article data-key="${key}">${['question','official','reasoning'].map(field=>`<div class="study-content ${field}-content" data-field="${field}">${r[field]}</div>`).join('')}</article>`).join('');
  await layout.setContent(`<html><head><base href="${base}"><style>${STUDY_CSS}body{margin:0;padding:16px}article{margin-bottom:24px}.study-content{font-size:17px;line-height:1.7;margin-bottom:24px}.study-table-wrap{overflow-x:auto}</style></head><body>${content}</body></html>`,{waitUntil:'networkidle'});
  const broken=await layout.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src));
  assert.deepEqual(broken,[],`${year}-${lang} images`);
  imageCount+=await layout.locator('img').count();editions+=Object.keys(records).length;
  for (const width of [720,360]) {
    await layout.setViewportSize({width,height:900});
    const bad=await layout.locator('.study-content').evaluateAll(nodes=>nodes.filter(e=>e.scrollWidth>e.clientWidth+3).map(e=>({key:e.closest('article').dataset.key,field:e.dataset.field,width:e.clientWidth,overflow:e.scrollWidth-e.clientWidth})));
    problems.push(...bad.map(p=>({...p,lang,viewport:width})));
  }
  console.log(`Layout checked ${year}-${lang}: ${Object.keys(records).length} editions`);
}
fs.writeFileSync(`${out}/layout-audit.json`,JSON.stringify({editions,imageCount,problems},null,2));
assert.deepEqual(problems,[],'content overflow; see layout-audit.json');
assert.deepEqual(errors,[]);
await browser.close();
console.log(`PASS: navigation, saved position, search, progressive answers, mobile picker, selected PDF export, loading recovery, ${editions} editions at two widths / ${imageCount} images.`);
