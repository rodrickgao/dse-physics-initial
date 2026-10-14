import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';
const out=path.resolve('../output/teacher-design-20261014'),f=await fixture('teacher-design'),browser=await chromium.launch({channel:'chrome',headless:true});
const c=f.client(),user=await f.register(c,'teacher-design@local.test'),admin=f.client();await admin.call('admin/login',{key:'isolated-deep-test-key'});
await c.call('tutoring',{kind:'knowledge',reference:'48',message:'我能读懂速度—时间图，但不确定如何从图中求位移。'});const answered=(await c.call('tutoring')).data.rows[0];await admin.call('admin/tutoring/reply',{id:answered.id,reply:'可以把图线与时间轴之间的面积分成矩形和三角形，分别计算后相加。'});
await c.call('tutoring',{kind:'question',reference:'2025|paper-1b|8',message:'这道题的第二步应该如何列式？'});
const report={views:[],flows:[],errors:[],responses:[]};let currentPage;
const field=(page,name)=>page.locator(`[data-teacher="${name}"]`);
const kind=page=>page.locator('.tutoring-form select').first();
const change=page=>page.locator('.ask-context button').click();
async function settled(page){await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});}
async function check(page,label){await settled(page);const style=await page.evaluate(()=>{const form=document.querySelector('.tutoring-form'),label=form.querySelector('label'),control=form.querySelector('select'),textarea=form.querySelector('textarea');return {overflow:document.documentElement.scrollWidth>innerWidth+2,labelWeight:getComputedStyle(label).fontWeight,controlWeight:getComputedStyle(control).fontWeight,textareaWeight:getComputedStyle(textarea).fontWeight,titleWeight:getComputedStyle(document.querySelector('.tutoring-view>h1')).fontWeight,controlFont:getComputedStyle(control).fontSize,broken:[...document.images].filter(i=>i.complete&&!i.naturalWidth).length};});assert.equal(style.overflow,false,label);assert.equal(style.controlWeight,'400',label);assert.equal(style.textareaWeight,'400',label);assert.equal(style.labelWeight,'500',label);assert.equal(style.titleWeight,'600',label);assert.equal(style.broken,0,label);report.views.push({label,...style,passed:true});}
try{
 for(const language of ['chn','eng'])for(const dark of [false,true])for(const width of [1440,1024,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  for(const [name,value]of c.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({id,language,dark})=>{try{localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem('dse-physics-theme-v1',dark?'dark':'light');localStorage.setItem(`ddphysics-tour:v4:${id}`,JSON.stringify({version:4,status:'skipped'}));}catch{}},{id:user.id,language,dark});
  context.on('page',p=>{p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)report.responses.push({status:r.status(),url:r.url()});});});
  const page=await context.newPage();currentPage=page;await page.goto(f.base+'#ask');await page.locator('.tutoring-form').waitFor();assert.equal(await page.locator('html').evaluate(el=>el.classList.contains('dark')),dark);await kind(page).selectOption('question');
  const label=`${language}/${dark?'dark':'light'}/${width}`;await check(page,label+'/source');assert.equal(await page.locator('.tutoring-form input[type="search"]').count(),0);
  await page.locator('[data-tour="teacher-message"]').focus();const focus=await page.locator('[data-tour="teacher-message"]').evaluate(el=>({visible:el.matches(':focus-visible'),shadow:getComputedStyle(el).boxShadow}));assert.equal(focus.visible,true);assert.notEqual(focus.shadow,'none');
  if([1440,390].includes(width))await page.screenshot({path:path.join(out,`source-${language}-${dark?'dark':'light'}-${width}.png`),fullPage:true});
  await field(page,'source').selectOption('past-paper');await field(page,'year').selectOption('2025');await field(page,'paper').selectOption('paper-1b');await check(page,label+'/past-paper');await field(page,'question').selectOption('2025|paper-1b|8');await page.locator('.ask-context').waitFor();await change(page);await check(page,label+'/context');
  await kind(page).selectOption('knowledge');await field(page,'book').selectOption('compulsory-2');await field(page,'chapter').selectOption('202');await check(page,label+'/knowledge');await field(page,'knowledge').selectOption('48');await page.locator('.ask-context').waitFor();
  assert.equal(await page.locator('.teacher-reply').count(),1);await page.locator('.teacher-reply').scrollIntoViewIfNeeded();await settled(page);assert.equal(await page.locator('.teacher-reply strong').evaluate(el=>getComputedStyle(el).fontWeight),'500');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  if([1440,390].includes(width))await page.screenshot({path:path.join(out,`reply-${language}-${dark?'dark':'light'}-${width}.png`),fullPage:true});
  report.flows.push({language,dark,width,focus:true,cascades:true,reply:true,passed:true});await context.close();
 }
 assert.equal(fs.readFileSync('src/views/AskTeacherView.jsx','utf8'),fs.readFileSync(path.join(out,'AskTeacherView.before.jsx'),'utf8'),'All existing component text and behavior remain unchanged');assert.deepEqual(report.errors,[]);assert.deepEqual(report.responses,[]);report.passed=true;
}catch(error){report.failure=error.stack;if(currentPage&&!currentPage.isClosed())await currentPage.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw error;}
finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
console.log(JSON.stringify({views:report.views.length,flows:report.flows.length,passed:report.passed}));
