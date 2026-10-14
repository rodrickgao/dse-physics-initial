import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';
import {numberKnowledgePoints} from '../src/lib/knowledge-numbering.js';
import {sharedFigureCards} from '../src/lib/shared-figure-cards.js';
const output=path.resolve(process.env.DSE_TEACHER_KNOWLEDGE_OUTPUT || '../output/teacher-knowledge-picker-20261014');fs.mkdirSync(output,{recursive:true});
const f=await fixture('teacher-knowledge-picker'),browser=await chromium.launch({channel:'chrome',headless:true});
const model={window:{}};vm.runInNewContext(fs.readFileSync('textbook-data.js','utf8'),model);
const report={views:[],chapters:[],flows:[],errors:[],responses:[]};let currentPage;
const c=f.client(),user=await f.register(c,'knowledge-picker@local.test');
const change=page=>page.locator('.ask-context button').click();
const kind=page=>page.locator('.tutoring-form select').first();
const book=page=>page.locator('[data-teacher="book"]');
const chapter=page=>page.locator('[data-teacher="chapter"]');
const knowledge=page=>page.locator('[data-teacher="knowledge"]');
const values=locator=>locator.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));
async function contextFor(language,width){
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
 for(const [name,value] of c.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
 await context.addInitScript(({id,language})=>{try{localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem(`ddphysics-tour:v4:${id}`,JSON.stringify({version:4,status:'skipped'}));}catch{}},{id:user.id,language});
 context.on('page',p=>{p.on('pageerror',error=>report.errors.push(error.message));p.on('response',r=>{if(r.status()>=400)report.responses.push({status:r.status(),url:r.url()});});});
 return context;
}
try{
 for(const language of ['chn','eng']){
  const points=numberKnowledgePoints(model.window.DSE_TEXTBOOK_DATA.languages[language]),cards=sharedFigureCards(points);
  const context=await contextFor(language,1440),page=await context.newPage();currentPage=page;
  await page.goto(f.base+'#ask');await page.locator('.tutoring-form').waitFor();await kind(page).selectOption('knowledge');
  assert.equal(await page.locator('.tutoring-form input[type="search"]').count(),0);
  assert.equal(await chapter(page).count(),0);assert.equal(await knowledge(page).count(),0);
  const expectedBooks=[1,2,3,4,5].map(n=>'compulsory-'+n).concat([1,2,3,4].map(n=>'elective-'+n));assert.deepEqual(await values(book(page)),expectedBooks);
  for(const bookKey of expectedBooks){
   f.advance(61000);await book(page).selectOption(bookKey);assert.equal(await knowledge(page).count(),0);
   const codes=[...new Set(points.filter(p=>p.book_key===bookKey).map(p=>p.code))];assert.deepEqual(await values(chapter(page)),codes);
   for(const code of codes){
    await chapter(page).selectOption(code);const expected=cards.filter(p=>p.book_key===bookKey&&p.code===code);
    assert.deepEqual(await values(knowledge(page)),expected.map(p=>String(p.sequence)));
    const labels=await knowledge(page).locator('option').evaluateAll(nodes=>nodes.filter(n=>n.value).map(n=>n.textContent));assert.equal(new Set(labels.map(label=>label.split('：')[0])).size,labels.length);
    report.chapters.push({language,bookKey,code,cards:expected.length,passed:true});
   }
  }
  for(const width of [1440,1024,390,320]){
   await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await book(page).selectOption('compulsory-2');await chapter(page).selectOption('202');
   assert.equal(await page.locator('.tutoring-form input[type="search"]').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   await page.screenshot({path:path.join(output,`${language}-${width}.png`),fullPage:true});report.views.push({language,width,passed:true});
  }
  const ref=(await values(knowledge(page)))[0];await knowledge(page).selectOption(ref);await page.locator('.ask-context').waitFor();
  await page.locator('[data-tour="teacher-message"]').fill('Isolated knowledge picker draft '+language);await page.reload();await page.locator('.ask-context').waitFor();assert.equal(await page.locator('[data-tour="teacher-message"]').inputValue(),'Isolated knowledge picker draft '+language);
  await change(page);assert.equal(await book(page).inputValue(),'compulsory-2');assert.equal(await chapter(page).inputValue(),'202');assert.equal(await knowledge(page).inputValue(),ref);
  await chapter(page).selectOption('201');assert.equal(await book(page).inputValue(),'compulsory-2');assert.equal(await knowledge(page).inputValue(),'');assert.equal(await page.locator('.tutoring-form').getByRole('button',{name:language==='eng'?'Ask a teacher':'问老师',exact:true}).isDisabled(),true);
  await book(page).selectOption('elective-1');assert.equal(await chapter(page).inputValue(),'');assert.equal(await knowledge(page).count(),0);
  await chapter(page).selectOption('E101');await page.reload();await book(page).waitFor();assert.equal(await book(page).inputValue(),'elective-1');assert.equal(await chapter(page).inputValue(),'E101');assert.equal(await knowledge(page).inputValue(),'');
  await book(page).selectOption('compulsory-2');await chapter(page).selectOption('202');await knowledge(page).selectOption(ref);await page.locator('[data-tour="teacher-message"]').fill('Isolated selected knowledge question '+language);
  await page.locator('.tutoring-form').getByRole('button',{name:language==='eng'?'Ask a teacher':'问老师',exact:true}).click();await page.locator('.tutoring-thread').filter({hasText:'Isolated selected knowledge question '+language}).waitFor();
  const submitted=(await c.call('tutoring')).data.rows.find(row=>row.message==='Isolated selected knowledge question '+language);assert.equal(submitted.kind,'knowledge');assert.equal(submitted.reference,ref);report.flows.push({language,flow:'draft/reset/submit',passed:true});
  // Historical source IDs inside merged cards must stay intact when changing the picker.
  const merged=cards.find(card=>card.members?.length>1),alias=String(merged.members.at(-1).sequence);
  await page.evaluate(({id,alias})=>{sessionStorage.setItem('dse-draft-v1:student:'+id+':context',JSON.stringify({kind:'knowledge',reference:alias}));}, {id:user.id,alias});await page.reload();await page.locator('.ask-context').waitFor();await change(page);assert.equal(await book(page).inputValue(),merged.book_key);assert.equal(await chapter(page).inputValue(),merged.code);assert.equal(await knowledge(page).inputValue(),alias);
  await chapter(page).selectOption('');assert.equal(await book(page).inputValue(),merged.book_key);assert.equal(await knowledge(page).count(),0);report.flows.push({language,flow:'legacy-merged-reference',passed:true});
  await kind(page).selectOption('question');await page.locator('[data-teacher="source"]').waitFor();assert.equal(await page.locator('.tutoring-form input[type="search"]').count(),0);assert.equal(await book(page).count(),0);await kind(page).selectOption('general');assert.equal(await page.locator('.tutoring-form input[type="search"]').count(),0);report.flows.push({language,flow:'other-question-types',passed:true});
  await page.setViewportSize({width:1440,height:1000});await page.goto(f.base+'#textbook?knowledge=48');await page.locator('[data-tour="knowledge-card"][data-study-knowledge-card="48"]').waitFor();await page.locator('[data-tour="knowledge-card"][data-study-knowledge-card="48"]').scrollIntoViewIfNeeded();
  await page.locator('.sidebar').getByRole('button',{name:language==='eng'?'Ask a teacher':'问老师',exact:true}).click();await page.locator('.ask-context').waitFor();await change(page);assert.equal(await book(page).inputValue(),'compulsory-2');assert.equal(await chapter(page).inputValue(),'202');assert.ok(await knowledge(page).inputValue());
  await page.locator('.tutoring-form').getByRole('button',{name:language==='eng'?'View selected content':'查看所选内容',exact:true}).click();await page.locator('.textbook-view').waitFor();report.flows.push({language,flow:'knowledge-reading-context-and-preview',passed:true});
  await context.close();
 }
 assert.equal(report.chapters.length,92);assert.equal(report.chapters.reduce((n,c)=>n+c.cards,0),562);assert.deepEqual(report.errors,[]);assert.deepEqual(report.responses,[]);report.passed=true;
}catch(error){report.failure=error.stack;if(currentPage&&!currentPage.isClosed())await currentPage.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw error;}
finally{fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
console.log(JSON.stringify({views:report.views.length,chapters:report.chapters.length,flows:report.flows.length,passed:report.passed}));
