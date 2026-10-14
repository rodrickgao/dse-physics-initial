import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';
import {questions, points} from '../server/catalog.mjs';

const output=path.resolve(process.env.DSE_SCROLL_QA_OUTPUT || '../output/filter-scroll-20261014');fs.mkdirSync(output,{recursive:true});
const f=await fixture('filter-scroll'),browser=await chromium.launch({channel:'chrome',headless:true});
const client=f.client(),user=await f.register(client,'filter-scroll@local.test');
f.db.prepare('INSERT INTO memberships VALUES(?,?,0,1)').run(user.id,f.clock()+30*86400000);
const names=['必修第一冊','必修第二冊','必修第五冊'];
const saved=names.flatMap((book,index)=>[...questions.values()].filter(q=>q.source==='textbook'&&points.get(q.points[0])?.book===book).slice(0,[18,5,4][index]).map(q=>q.key));
assert.equal((await client.call('mistakes/import',{keys:saved})).status,200);
const before=(await client.call('mistakes')).data,report={views:[],errors:[]};let lastPage;
try{
 for(const language of ['chn','eng'])for(const mode of [{width:1440,height:1000},{width:1024,height:768},{width:390,height:844},{width:320,height:740},{width:390,height:844,motion:'no-preference'}]){
  f.advance(61000);const context=await browser.newContext({viewport:{width:mode.width,height:mode.height},hasTouch:mode.width<1100,reducedMotion:mode.motion||'reduce'});
  for(const [name,value]of client.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({id,language})=>{localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped',lastCompleted:-1,skippedSteps:[],pages:{}}));},{id:user.id,language});
  const page=await context.newPage();lastPage=page;page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(f.base+'#mistakes');await page.locator('#statistics-book').waitFor();
  let extraRequests=0;await page.route('**/api/content/mistake-summary*',route=>{extraRequests++;return route.abort();});
  const measurements=[];
  for(const key of ['compulsory-2','all','compulsory-5','compulsory-3','all','compulsory-1','all']){
   await page.evaluate(()=>{const selector=document.getElementById('statistics-book');scrollTo({top:scrollY+selector.getBoundingClientRect().top-180,behavior:'instant'});selector.focus({preventScroll:true});});
   const old=await page.locator('#statistics-book').evaluate(n=>({top:n.getBoundingClientRect().top,y:scrollY}));
   assert.ok(old.y>100,'check runs below page top');
   await page.locator('#statistics-book').selectOption(key);
   await page.waitForFunction(key=>document.getElementById('statistics-book')?.value===key,key);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const next=await page.locator('#statistics-book').evaluate(n=>({top:n.getBoundingClientRect().top,y:scrollY,focused:n===document.activeElement,docHeight:document.documentElement.scrollHeight,viewHeight:n.closest('.mistakes-view').offsetHeight,minHeight:n.closest('.mistakes-view').style.minHeight}));
   assert.ok(Math.abs(next.top-old.top)<=2,JSON.stringify({language,...mode,key,old,next}));
   assert.ok(next.focused);assert.equal(await page.locator('.mistakes-view>[role="status"]').count(),0);
   const expected=key==='all'?saved:saved.filter(k=>{const book=points.get(questions.get(k).points[0])?.book;return book===({'compulsory-1':names[0],'compulsory-2':names[1],'compulsory-5':names[2]})[key];});
   assert.deepEqual((await page.locator('[data-mistake]').evaluateAll(ns=>ns.map(n=>n.dataset.mistake))).sort(),expected.toSorted());
   measurements.push({key,old,next});
  }
  await page.evaluate(()=>{const selector=document.getElementById('statistics-book');scrollTo({top:scrollY+selector.getBoundingClientRect().top-180,behavior:'instant'});});
  const top=await page.locator('#statistics-book').evaluate(n=>n.getBoundingClientRect().top);
  const first=page.locator('.statistics-chapter-list li').first(),code=await first.getAttribute('data-chapter');
  await first.locator('button').click();
  assert.ok(page.url().includes('chapter='+code));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.ok(Math.abs(await page.locator('#statistics-book').evaluate(n=>n.getBoundingClientRect().top)-top)<=2,'chapter click preserves panel position');
  assert.equal(extraRequests,0);assert.deepEqual((await client.call('mistakes')).data,before);
  if(language==='chn'&&(mode.width===1440||mode.width===390))await page.screenshot({path:path.join(output,`filtered-${mode.width}.png`)});
  report.views.push({language,...mode,measurements,chapterPositionPreserved:true,noReload:true,focusPreserved:true,correctQuestions:true,passed:true});
  console.log(`PASS ${language} ${mode.width}`);await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(output,'failure.png')});throw error;}
finally{fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
