import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const base = process.env.QA_URL || 'http://127.0.0.1:5173/';
const out = '../tmp/document-sync-qa';fs.mkdirSync(out,{recursive:true});
const browser = await chromium.launch({headless:true,channel:'chrome'});
const errors=[];
try {
 for(const language of ['eng','chn']) {
  const page=await browser.newPage({viewport:{width:1400,height:950}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(lang=>localStorage.setItem('dse-physics-language-v1',lang),language);
  await page.request.post(base+'api/admin/login', {data:{key:fs.readFileSync('.local/admin-key.txt','utf8').trim()}});
  await page.goto(base+'#textbook');
  await page.locator('.book-card').first().waitFor();
  assert.equal(await page.locator('.source-download').count(),0);
  assert.equal((await page.request.get(base+'downloads/'+language+'/knowledge.pdf')).status(),404);
  let total=0;
  for(let book=0;book<9;book++) {
   await page.locator('.book-card').nth(book).click();
   const labels=await page.locator('.knowledge-point-head>div>span').allTextContents();
   total+=labels.length;
   assert.ok(labels.every(s=>/^E?\d\.\d+\.\d+$/.test(s)));
   assert.equal(labels[0],`${book<5?'':'E'}${book<5?book+1:book-4}.1.1`);
   assert.equal(await page.locator('.knowledge-point-head small').count(),0);
   await page.locator('.back-books').click();
  }
  assert.equal(total,365);
  await page.locator('.knowledge-search-wrap input').fill('E1.1.1');
  assert.ok((await page.locator('.knowledge-point-head>div>span').allTextContents()).includes('E1.1.1'));
  await page.screenshot({path:`${out}/${language}-knowledge.png`,fullPage:true});
  for(const width of [1400,390]) {
   await page.setViewportSize({width,height:950});
   await page.goto(base+'#papers?question=2013%7Cpaper-1a%7C1');
   await page.locator('.question-content').waitFor();
   assert.equal(await page.locator('.source-download').getAttribute('href'),`downloads/originals/${language}/2013-paper-1a.pdf`);
   if (await page.locator('[aria-controls="official-stage"]').getAttribute('aria-expanded') !== 'true') await page.locator('[aria-controls="official-stage"]').click();
   if (await page.locator('[aria-controls="reasoning-stage"]').getAttribute('aria-expanded') !== 'true') await page.locator('[aria-controls="reasoning-stage"]').click();
   await page.locator('.reasoning-content').waitFor();
   const related=await page.locator('.related-panel button span').allTextContents();
   assert.ok(related.every(s=>/^E?\d\.\d+\.\d+$/.test(s)));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`${out}/${language}-paper-${width}.png`,fullPage:true});
  }
  await page.goto(base+'#papers?question=2025%7Cpaper-1a%7C1');
  await page.locator('.question-content').waitFor();
  if (language === 'chn') {
    assert.equal(await page.locator('a.source-download').count(), 0);
    assert.match(await page.locator('.source-download-unavailable').innerText(), /2025.*ENG/);
  } else assert.equal(await page.locator('a.source-download').getAttribute('href'), 'downloads/originals/eng/2025-paper-1a.pdf');
  await page.goto(base+'#papers?question=2024%7Cpaper-1a%7C1');
  await page.locator('.question-content').waitFor();
  if (language === 'eng') assert.equal(await page.locator('a.source-download').count(), 0);
  else assert.equal(await page.locator('a.source-download').getAttribute('href'), 'downloads/originals/chn/2024-paper-1a.pdf');
  assert.equal(await page.getByText('下載全卷詳解 PDF', {exact:true}).count(),0);
  await page.close();
 }
 assert.deepEqual(errors,[]);
 for(const f of JSON.parse(fs.readFileSync('downloads/catalog.json','utf8')).files) {
  const response=await fetch(base+f.url);assert.equal(response.status,200,f.url);
  assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),f.sha256);
 }
 for (const language of ['eng','chn']) for (let year=2012; year<=2025; year++) for (const paper of ['paper-1a','paper-1b','paper-2']) {
   const response=await fetch(base+'downloads/'+language+'/'+year+'-'+paper+'.pdf');
   assert.equal(response.status,404,'Retired worked paper is still accessible');
 }
 console.log('PASS: 730 cards, bilingual navigation and numbering, mobile reading, all 78 PDF downloads match source hashes.');
}finally{await browser.close();}
