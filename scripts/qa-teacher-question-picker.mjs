import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import vm from 'node:vm';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';import {exerciseNumber} from '../src/lib/exercise-numbering.js';
const out=path.resolve('../output/teacher-question-picker-20261014');fs.mkdirSync(out,{recursive:true});
const f=await fixture('teacher-question-picker'),browser=await chromium.launch({channel:'chrome',headless:true});
const c=f.client(),user=await f.register(c,'question-picker@local.test');
const report={groups:[],views:[],flows:[],errors:[],responses:[],injectedFailures:[]};let currentPage;
const model={window:{}};vm.runInNewContext(fs.readFileSync('site-data.js','utf8'),model);
const select=(page,name)=>page.locator(`[data-teacher="${name}"]`);
const options=locator=>locator.locator('option').evaluateAll(nodes=>nodes.filter(n=>n.value).map(n=>({value:n.value,label:n.textContent})));
const values=async locator=>(await options(locator)).map(o=>o.value);
const kind=page=>page.locator('.tutoring-form select').first();
const source=page=>select(page,'source'),question=page=>select(page,'question');
const change=page=>page.locator('.ask-context button').click();
const ready=page=>page.waitForFunction(()=>{const s=document.querySelector('[data-teacher="question"]');return s&&!s.disabled&&s.options.length>1;});
async function selectSource(page,value){if(await page.locator('.ask-context').count())await change(page);await source(page).selectOption(value);}
async function textbook(page,sourceName,bookKey,code){await selectSource(page,sourceName);await select(page,'question-book').selectOption(bookKey);await select(page,'question-chapter').selectOption(code);await ready(page);}
async function check(page,language,width,mode){await page.setViewportSize({width,height:1000});await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});assert.equal(await page.locator('.tutoring-form input[type="search"]').count(),0);const overflow=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+2;}).map(el=>({tag:el.tagName,className:el.className,text:el.textContent.slice(0,70),width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right,minWidth:getComputedStyle(el).minWidth})).slice(0,10)}));assert.ok(overflow.scrollWidth<=width+2,JSON.stringify({language,mode,...overflow}));await page.screenshot({path:path.join(out,`${mode}-${language}-${width}.png`),fullPage:true});report.views.push({language,width,mode,passed:true});}
try{
 for(const language of ['chn','eng']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  for(const [name,value] of c.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({id,language})=>{try{localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem(`ddphysics-tour:v4:${id}`,JSON.stringify({version:4,status:'skipped'}));}catch{}},{id:user.id,language});
  context.on('page',p=>{p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)report.responses.push({url:r.url(),status:r.status()});});});
  const page=await context.newPage();currentPage=page;await page.goto(f.base+'#ask');await page.locator('.tutoring-form').waitFor();await kind(page).selectOption('question');
  assert.equal(await page.locator('.tutoring-form input[type="search"]').count(),0);assert.equal(await question(page).count(),0);assert.deepEqual(await values(source(page)),['past-paper','examples','textbook']);
  await selectSource(page,'past-paper');assert.equal(await select(page,'paper').count(),0);
  const years=Array.from(model.window.DSE_SITE_DATA.years).filter(y=>y.language===language).sort((a,b)=>Number(a.year)-Number(b.year));assert.deepEqual(await values(select(page,'year')),years.map(y=>String(y.year)));
  for(const year of years){
   await select(page,'year').selectOption(String(year.year));assert.equal(await question(page).count(),0);assert.deepEqual(await values(select(page,'paper')),['paper-1a','paper-1b','paper-2']);
   for(const [index,paperId] of ['paper-1a','paper-1b','paper-2'].entries()){
    await select(page,'paper').selectOption(paperId);const expected=year.papers[index].questions.map((q,i)=>`${year.year}|${paperId}|${q.id||Number(String(q.label).replace(/\D/g,''))||i+1}`);
    assert.deepEqual(await values(question(page)),Array.from(expected));report.groups.push({language,source:'past-paper',year:year.year,paperId,count:expected.length,passed:true});
   }
  }
  for(const sourceName of ['examples','textbook']){
   const index=JSON.parse(fs.readFileSync(`assets/${sourceName==='examples'?'textbook-examples':'textbook-exercises'}/index-${language}.json`,'utf8'));
   await selectSource(page,sourceName);assert.equal(await select(page,'question-chapter').count(),0);assert.deepEqual(await values(select(page,'question-book')),index.books.map(b=>b.id));
   for(const book of index.books){
    await select(page,'question-book').selectOption(book.id);assert.equal(await question(page).count(),0);assert.deepEqual(await values(select(page,'question-chapter')),book.chapters.map(c=>c.id));
    for(const chapter of book.chapters){
     f.advance(61000);await select(page,'question-chapter').selectOption(chapter.id);await ready(page);
     const expected=index.questions.filter(q=>q.chapter===chapter.id);assert.deepEqual(await values(question(page)),expected.map(q=>q.id));
     if(sourceName==='textbook'){const rendered=await options(question(page));assert.ok(rendered.every((q,i)=>q.label.includes(String(exerciseNumber(expected[i].id)))));}
     report.groups.push({language,source:sourceName,book:book.id,chapter:chapter.id,count:expected.length,passed:true});
    }
   }
  }
  for(const mode of ['past-paper','examples','textbook']){
   if(mode==='past-paper'){await selectSource(page,mode);await select(page,'year').selectOption('2012');await select(page,'paper').selectOption('paper-2');}
   else await textbook(page,mode,'compulsory-3','3B04');
   for(const width of [1440,1024,390,320])await check(page,language,width,mode);
  }
  const cases=[['past-paper','2012|paper-2|1.3'],['examples','ex-3B04-1'],['textbook','tb-E403-15']];
  for(const [mode,id] of cases){
   if(mode==='past-paper'){await selectSource(page,mode);await select(page,'year').selectOption('2012');await select(page,'paper').selectOption('paper-2');}
   else await textbook(page,mode,mode==='examples'?'compulsory-3':'elective-4',mode==='examples'?'3B04':'E403');
   await question(page).selectOption(id);await page.locator('.ask-context').waitFor();const text=`Isolated ${language} ${mode} question`;await page.locator('[data-tour="teacher-message"]').fill(text);await page.reload();await page.locator('.ask-context').waitFor();assert.equal(await page.locator('[data-tour="teacher-message"]').inputValue(),text);await change(page);if(mode!=='past-paper')await ready(page);assert.equal(await question(page).inputValue(),id);
   await page.locator('.tutoring-form').getByRole('button',{name:language==='eng'?'Ask a teacher':'问老师',exact:true}).click();await page.locator('.tutoring-thread').filter({hasText:text}).waitFor();assert.equal((await c.call('tutoring')).data.rows.find(row=>row.message===text).reference,id);report.flows.push({language,mode,flow:'draft/restore/submit',passed:true});
  }
  // A new parent selection clears every dependent value, including restored references.
  await selectSource(page,'past-paper');await select(page,'year').selectOption('2025');await select(page,'paper').selectOption('paper-1b');await question(page).selectOption('2025|paper-1b|8');await change(page);await select(page,'year').selectOption('2024');assert.equal(await select(page,'paper').inputValue(),'');assert.equal(await question(page).count(),0);
  await textbook(page,'textbook','compulsory-2','202');await question(page).selectOption('tb-202-1');await change(page);await select(page,'question-book').selectOption('elective-4');assert.equal(await select(page,'question-chapter').inputValue(),'');assert.equal(await question(page).count(),0);
  await select(page,'question-chapter').selectOption('E403');await ready(page);await page.reload();await select(page,'source').waitFor();await ready(page);assert.equal(await source(page).inputValue(),'textbook');assert.equal(await select(page,'question-book').inputValue(),'elective-4');assert.equal(await select(page,'question-chapter').inputValue(),'E403');assert.equal(await question(page).inputValue(),'');report.flows.push({language,flow:'parent-reset/partial-draft',passed:true});
  await page.setViewportSize({width:1440,height:1000});for(const [route,selector,mode] of [['examples?question=ex-3B04-1','[data-example][aria-busy="false"]','examples'],['exercises?question=tb-E403-15','[data-exercise][aria-busy="false"]','textbook'],['papers?question=2012%7Cpaper-2%7C1.3','[data-question][aria-busy="false"]','past-paper']]){
   await page.goto(f.base+'#'+route);await page.locator(selector).waitFor();await page.locator('.sidebar').getByRole('button',{name:language==='eng'?'Ask a teacher':'问老师',exact:true}).click();await page.locator('.ask-context').waitFor();await change(page);if(mode!=='past-paper')await ready(page);assert.equal(await source(page).inputValue(),mode);assert.ok(await question(page).inputValue());await page.locator('.tutoring-form').getByRole('button',{name:language==='eng'?'View selected content':'查看所选内容',exact:true}).click();await page.locator(selector).waitFor();report.flows.push({language,mode,flow:'reader-context-and-preview',passed:true});
  }
  await page.goto(f.base+'#ask');await page.locator('.tutoring-form').waitFor();if(await page.locator('.ask-context').count())await change(page);await kind(page).selectOption('knowledge');assert.equal(await source(page).count(),0);await select(page,'book').selectOption('compulsory-2');await select(page,'chapter').selectOption('202');assert.ok((await values(select(page,'knowledge'))).length);assert.equal(await page.locator('.tutoring-form input[type="search"]').count(),0);report.flows.push({language,flow:'knowledge-regression',passed:true});
  await context.close();
 }
 assert.equal(report.groups.reduce((n,g)=>n+g.count,0),4936);assert.deepEqual(report.errors,[]);assert.deepEqual(report.responses,[]);report.passed=true;
}catch(error){report.failure=error.stack;if(currentPage&&!currentPage.isClosed())await currentPage.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw error;}
finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
console.log(JSON.stringify({groups:report.groups.length,questions:report.groups.reduce((n,g)=>n+g.count,0),views:report.views.length,flows:report.flows.length,passed:report.passed}));
