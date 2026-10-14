import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';
import {questions, points} from '../server/catalog.mjs';
import {BOOK_COLORS} from '../src/lib/book-colors.js';

const output=path.resolve(process.env.DSE_BOOK_STATS_OUTPUT || '../output/all-book-filter-20261014');
fs.mkdirSync(output,{recursive:true});
const f=await fixture('inline-book-statistics'), browser=await chromium.launch({channel:'chrome',headless:true});
const report={views:[],flows:[],errors:[]};let lastPage;
const names=['必修第一冊','必修第二冊','必修第三冊','必修第四冊','必修第五冊','選修第一冊','選修第二冊','選修第三冊','選修第四冊'];
const catalogBooks=names.map((name,index)=>({key:`${index<5?'compulsory':'elective'}-${index<5?index+1:index-4}`,codes:[...new Set([...points.values()].filter(p=>p.book===name).map(p=>p.code))]}));
const saved=catalogBooks[0].codes.slice(0,3).flatMap((code,index)=>[...questions.values()].filter(q=>q.source==='textbook'&&q.primaryChapterCode===code).slice(0,[1,3,2][index]).map(q=>q.key));
const other=[1,4,6].map(index=>[...questions.values()].find(q=>q.source==='textbook'&&catalogBooks[index].codes.includes(q.primaryChapterCode)).key);
saved.push(...other);assert.equal(saved.length,9);
const client=f.client(),user=await f.register(client,'inline-book-stats@local.test');
f.db.prepare('INSERT INTO memberships VALUES(?,?,0,1)').run(user.id,f.clock()+30*86400000);
assert.equal((await client.call('mistakes/import',{keys:saved})).status,200);
const before=(await client.call('mistakes')).data;
async function contextFor(language,mode){
 f.advance(61000);const context=await browser.newContext({viewport:mode,hasTouch:mode.width<1100,reducedMotion:'reduce'});
 for(const [name,value]of client.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
 await context.addInitScript(({id,language})=>{localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped',lastCompleted:-1,skippedSteps:[],pages:{}}));},{id:user.id,language});
 const page=await context.newPage();lastPage=page;page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(f.base+'#mistakes');await page.locator('#statistics-book').waitFor();return {context,page};
}
async function waitForKeys(page, keys) {
 await page.waitForFunction(keys=>{const actual=[...document.querySelectorAll('[data-mistake]')].map(n=>n.dataset.mistake);return actual.length===keys.length&&actual.every(key=>keys.includes(key))&&!!document.querySelector('#statistics-book');},keys);
}
async function selectAll(page, keys=saved) {
 await page.locator('#statistics-book').selectOption('all');await waitForKeys(page,keys);
 assert.equal(await page.locator('#statistics-book').inputValue(),'all');
 assert.equal(await page.locator('.mistake-review-filter').count(),0);
 assert.equal(new URLSearchParams(page.url().split('?')[1]).has('chapter'),false);
 assert.equal(new URLSearchParams(page.url().split('?')[1]).has('book'),false);
}
try{
 for(const language of ['chn','eng'])for(const mode of [{width:1440,height:1000},{width:1024,height:768},{width:390,height:844},{width:320,height:740}]){
  const {context,page}=await contextFor(language,mode);
  const summary=(await client.call('content/mistake-summary?language='+language)).data;
  assert.ok(summary.chapters);
  assert.deepEqual(await page.locator('#statistics-book option').evaluateAll(ns=>ns.map(n=>n.value)),['all',...catalogBooks.map(b=>b.key)]);
  assert.equal(await page.locator('#statistics-book').inputValue(),'all');
  assert.equal(await page.locator('.mistake-distribution h3').textContent(),language==='eng'?'Mistake statistics':'错题统计');
  const allChapters=catalogBooks.flatMap(book=>book.codes.map(code=>({code,count:summary.chapters.find(c=>c.code===code)?.keys.length||0}))).filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
  assert.deepEqual(await page.locator('.statistics-chapter-list li').evaluateAll(ns=>ns.map(n=>({code:n.dataset.chapter,count:Number(n.querySelector('strong').textContent)}))),allChapters);
  assert.equal(Number(await page.locator('.statistics-book-total strong').textContent()),saved.length);
  if(language==='chn'&&(mode.width===1440||mode.width===390))await page.locator('.mistake-review-card').screenshot({path:path.join(output,`all-${mode.width}.png`)});
  assert.equal(await page.locator('.chapter-pie,.chapter-pie-legend,.chapter-statistics-link,dialog.mistake-statistics').count(),0);
  for(const book of catalogBooks){
   await page.locator('#statistics-book').selectOption(book.key);
   const visible=book.codes.map(code=>({code,keys:summary.chapters.find(c=>c.code===code)?.keys||[]})).filter(c=>c.keys.length>0).sort((a,b)=>b.keys.length-a.keys.length);
   await waitForKeys(page,visible.flatMap(c=>c.keys));
   assert.ok(page.url().includes('book='+book.key));
   assert.deepEqual(await page.locator('.statistics-chapter-list li').evaluateAll(ns=>ns.map(n=>({code:n.dataset.chapter,count:Number(n.querySelector('strong').textContent)}))),visible.map(c=>({code:c.code,count:c.keys.length})));
   if(visible.length)assert.equal(Number(await page.locator('.statistics-book-total strong').textContent()),visible.reduce((sum,c)=>sum+c.keys.length,0));
   else {assert.equal(await page.locator('.statistics-book-empty').count(),1);assert.equal(await page.locator('.statistics-book-total').count(),0);}
   assert.equal(await page.locator('.mistake-book-statistics').evaluate(n=>n.style.getPropertyValue('--book-tone')),BOOK_COLORS[book.key]);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   assert.ok(await page.locator('.mistake-book-statistics').evaluate(n=>n.scrollWidth<=n.clientWidth+2));
   assert.equal(await page.locator('.mistake-review-filter').count(),0);
   if(!visible.length){await selectAll(page);continue;}
   const chapter=visible[0];await page.locator(`li[data-chapter="${chapter.code}"] button`).focus();await page.keyboard.press('Enter');
   await page.waitForFunction(keys=>{const actual=[...document.querySelectorAll('[data-mistake]')].map(n=>n.dataset.mistake);return actual.length===keys.length&&actual.every(key=>keys.includes(key));},chapter.keys);
   assert.ok(page.url().includes('chapter='+chapter.code));assert.equal(await page.locator('#statistics-book').inputValue(),book.key);
   await selectAll(page);
   assert.equal(Number(await page.locator('.statistics-book-total strong').textContent()),saved.length);
  }
  await page.locator('#statistics-book').selectOption('compulsory-1');
  await waitForKeys(page,saved.filter(key=>catalogBooks[0].codes.includes(questions.get(key).primaryChapterCode)));
  if(language==='chn'&&(mode.width===1440||mode.width===390))await page.locator('.mistake-review-card').screenshot({path:path.join(output,`chapters-${mode.width}.png`)});
  await page.locator('#statistics-book').selectOption('compulsory-2');
  await waitForKeys(page,[other[0]]);
  await page.locator('.statistics-chapter-list button').first().click();
  await page.waitForFunction(key=>document.querySelector('[data-mistake]')?.dataset.mistake===key,other[0]);
  const selected=await page.locator('[data-mistake]').evaluateAll(ns=>ns.map(n=>n.dataset.mistake));
  await page.locator('[data-mistake]').first().getByRole('button',{name:language==='eng'?'Open':'打开',exact:true}).click();
  await page.waitForFunction(()=>!location.hash.startsWith('#mistakes'));await page.goBack();
  await page.waitForFunction(key=>document.querySelector('[data-mistake]')?.dataset.mistake===key,other[0]);
  assert.equal(await page.locator('#statistics-book').inputValue(),'compulsory-2');
  assert.deepEqual((await page.locator('[data-mistake]').evaluateAll(ns=>ns.map(n=>n.dataset.mistake))).sort(),selected.sort());
  await selectAll(page);
  await page.reload();await waitForKeys(page,saved);assert.equal(await page.locator('#statistics-book').inputValue(),'all');
  assert.deepEqual((await client.call('mistakes')).data,before);
  report.views.push({language,...mode,allFirst:true,allNineBooks:true,bookFiltersQuestions:true,allClearsChapterAndBook:true,noBlueBanner:true,chaptersSorted:true,zeroChaptersHidden:true,totalsMatch:true,bookColors:true,keyboardFilter:true,openAndReturn:true,selectionRetained:true,noOverflow:true,passed:true});
  await context.close();console.log(`PASS ${language} ${mode.width}`);
 }
 {
  const {context,page}=await contextFor('chn',{width:1440,height:1000});
  await page.locator('#statistics-book').selectOption('compulsory-2');
  await waitForKeys(page,[other[0]]);
  const chapter=await page.locator('.statistics-chapter-list li').getAttribute('data-chapter');
  await page.locator('.statistics-chapter-list button').click();await page.locator(`[data-mistake="${other[0]}"]`).waitFor();
  await page.locator(`[data-mistake="${other[0]}"]`).getByRole('button',{name:'标为已掌握',exact:true}).click();
  await page.locator('.statistics-book-empty').waitFor();
  assert.equal(await page.locator('#statistics-book').inputValue(),'compulsory-2');assert.equal(await page.locator(`li[data-chapter="${chapter}"]`).count(),0);
  await selectAll(page,saved.filter(key=>key!==other[0]));
  assert.equal(Number(await page.locator('.statistics-book-total strong').textContent()),saved.length-1);
  report.flows.push({masteryRefresh:true,zeroChapterHidden:true,emptyBook:true,selectionRetained:true});
  f.db.prepare('DELETE FROM memberships WHERE user_id=?').run(user.id);f.advance(61000);await page.reload();await page.locator('.mistake-distribution').waitFor();
  assert.equal(await page.locator('#statistics-book,.statistics-chapter-list').count(),0);assert.match(await page.locator('.mistake-distribution').textContent(),/会员/);
  report.flows.push({membershipPreserved:true});await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw error;}
finally{fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
