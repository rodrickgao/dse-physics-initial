import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';
import {questions, points} from '../server/catalog.mjs';
import {BOOK_COLORS} from '../src/lib/book-colors.js';

const output=path.resolve('../output/mistake-book-stats-20261014');
fs.mkdirSync(output,{recursive:true});
const f=await fixture('book-statistics'), browser=await chromium.launch({channel:'chrome',headless:true});
const report={views:[],flows:[],errors:[]};let lastPage;
const counts=[2,5,0,3,1,0,2,0,1];
const saved=[...new Set([...new Set([...points.values()].map(p=>p.book))].flatMap((book,index)=>[...questions.values()].filter(q=>q.source==='textbook'&&points.get(q.points[0])?.book===book).slice(0,counts[index]).map(q=>q.key)))];
assert.ok(saved.every(key=>questions.has(key)));
const client=f.client(),user=await f.register(client,'book-stats@local.test');
f.db.prepare('INSERT INTO memberships VALUES(?,?,0,1)').run(user.id,f.clock()+30*86400000);
assert.equal((await client.call('mistakes/import',{keys:saved})).status,200);
const before=(await client.call('mistakes')).data;
try{
 for(const language of ['chn','eng'])for(const mode of [{width:1440,height:1000},{width:1024,height:768},{width:390,height:844},{width:320,height:740}]){
  f.advance(61000);
  const context=await browser.newContext({viewport:mode,hasTouch:mode.width<1100,reducedMotion:'reduce'});
  for(const [name,value]of client.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({id,language})=>{localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped',lastCompleted:-1,skippedSteps:[],pages:{}}));},{id:user.id,language});
  const page=await context.newPage();lastPage=page;page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(f.base+'#mistakes');await page.locator('[data-book]').first().waitFor();
  const expected=await page.evaluate(async()=>{
   const summary=await(await fetch('/api/content/mistake-summary?language='+localStorage.getItem('dse-physics-language-v1'))).json();
   const points=window.DSE_TEXTBOOK_DATA.languages[localStorage.getItem('dse-physics-language-v1')];
   const names=localStorage.getItem('dse-physics-language-v1')==='eng'?['Compulsory Book 1','Compulsory Book 2','Compulsory Book 3','Compulsory Book 4','Compulsory Book 5','Elective Book 1','Elective Book 2','Elective Book 3','Elective Book 4']:['必修第一冊','必修第二冊','必修第三冊','必修第四冊','必修第五冊','選修第一冊','選修第二冊','選修第三冊','選修第四冊'];
   return names.map((name,i)=>{const chapters=[...new Set(points.filter(p=>p.book===name).map(p=>p.code))].map(code=>({code,count:summary.chapters.find(c=>c.code===code)?.keys.length||0}));return {key:`${i<5?'compulsory':'elective'}-${i<5?i+1:i-4}`,chapters,count:chapters.reduce((n,c)=>n+c.count,0)};});
  });
  const visible=expected.filter(b=>b.count>0).sort((a,b)=>b.count-a.count);
  assert.deepEqual(await page.locator('[data-book]').evaluateAll(ns=>ns.map(n=>({key:n.dataset.book,count:Number(n.querySelector('strong').textContent)}))),visible.map(b=>({key:b.key,count:b.count})));
  const colors=await page.locator('[data-book]').evaluateAll(ns=>ns.map(n=>({key:n.dataset.book,color:n.querySelector('i').style.backgroundColor})));
  const rgb=hex=>`rgb(${hex.slice(1).match(/../g).map(n=>parseInt(n,16)).join(', ')})`;
  for(const row of colors.filter(row=>row.key.startsWith('compulsory')))assert.equal(row.color,rgb(BOOK_COLORS[row.key]));
  const gradient=await page.locator('.chapter-pie>span').evaluate(n=>n.style.background);
  for(const row of colors)assert.ok(gradient.includes(row.color),row.key);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  if(language==='chn'&&(mode.width===1440||mode.width===390))await page.locator('.mistake-review-card').screenshot({path:path.join(output,`overview-${mode.width}.png`)});
  await page.locator('.chapter-pie').click();const dialog=page.locator('dialog[open]');await dialog.waitFor();
  assert.equal(await dialog.locator('.chapter-pie').count(),0);
  assert.equal(await page.locator('#statistics-book option').count(),9);
  for(const book of expected){
   await page.locator('#statistics-book').selectOption(book.key);
   assert.deepEqual(await dialog.locator('tbody tr').evaluateAll(ns=>ns.map(n=>({code:n.dataset.chapter,count:Number(n.querySelector('td').textContent)}))),book.chapters);
   assert.equal(await dialog.locator('tfoot td').first().textContent(),String(book.count));
   assert.ok(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+2));
  }
  await page.locator('#statistics-book').selectOption('compulsory-1');
  if(language==='chn'&&(mode.width===1440||mode.width===390))await dialog.screenshot({path:path.join(output,`details-${mode.width}.png`)});
  const row=dialog.locator('tbody tr:has(button)').first(),code=await row.getAttribute('data-chapter'),count=Number(await row.locator('td').first().textContent());
  await row.locator('button').click();await dialog.waitFor({state:'hidden'});await page.waitForFunction(n=>document.querySelectorAll('[data-mistake]').length===n,count);
  assert.ok(page.url().includes('chapter='+code));
  await page.locator('.mistake-review-filter button').click();await page.locator('.chapter-statistics-link').click();await dialog.waitFor();
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  assert.ok(await page.locator('.chapter-statistics-link').evaluate(n=>n===document.activeElement));
  assert.deepEqual((await client.call('mistakes')).data,before);
  await page.goto(f.base+'#textbook');await page.locator('.book-card').first().waitFor();
  const libraryColors=await page.locator('.book-card').evaluateAll(ns=>ns.slice(0,5).map(n=>n.style.getPropertyValue('--book-tone')));
  assert.deepEqual(libraryColors,Object.values(BOOK_COLORS).slice(0,5));
  report.views.push({language,...mode,descendingCounts:true,zeroBooksHidden:true,compulsoryColorsMatchLibrary:true,pieColorsMatchLegend:true,all46Chapters:true,countsMatch:true,chapterFilter:true,keyboardClose:true,noOverflow:true,passed:true});
  await context.close();console.log(`PASS ${language} ${mode.width}`);
 }
 // Updating mastery refreshes the overview without retaining the removed mistake.
 {
  f.advance(61000);const context=await browser.newContext({viewport:{width:1440,height:1000}});
  for(const [name,value]of client.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(id=>{localStorage.setItem('dse-physics-language-v1','chn');localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped',lastCompleted:-1,skippedSteps:[],pages:{}}));},user.id);
  const page=await context.newPage();lastPage=page;await page.goto(f.base+'#mistakes');await page.locator('[data-book]').first().waitFor();
  const old=(await page.locator('[data-book] strong').allTextContents()).map(Number).reduce((a,b)=>a+b,0);
  await page.locator('[data-mistake="tb-101-1"]').getByRole('button',{name:'标为已掌握',exact:true}).click();
  await page.waitForFunction(old=>[...document.querySelectorAll('[data-book] strong')].reduce((n,e)=>n+Number(e.textContent),0)===old-1,old);
  await page.locator('.chapter-statistics-link').click();await page.locator('dialog[open]').waitFor();
  await page.locator('#statistics-book').selectOption('compulsory-1');
  assert.equal(Number(await page.locator('tfoot td').first().textContent()),counts[0]-1);
  report.flows.push({masteryRefresh:true});await page.keyboard.press('Escape');
  await page.locator('[data-mistake="tb-101-2"]').getByRole('button',{name:'标为已掌握',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-book="compulsory-1"]'));
  assert.deepEqual(await page.locator('[data-book] strong').allTextContents(),['5','3','2','1','1']);
  report.flows.push({zeroAfterMasteryHidden:true,remainingCountsSorted:true});
  // Membership remains required for this existing statistics feature.
  f.db.prepare('DELETE FROM memberships WHERE user_id=?').run(user.id);f.advance(61000);await page.reload();await page.locator('.mistake-distribution').waitFor();
  assert.equal(await page.locator('.chapter-statistics-link,.chapter-pie').count(),0);assert.equal(await page.locator('dialog[open]').count(),0);
  report.flows.push({membershipPreserved:true});await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw error;}
finally{fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
