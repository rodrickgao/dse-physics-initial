import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';
const out=path.resolve('../output/teacher-question-picker-20261014'),f=await fixture('teacher-picker-loading'),browser=await chromium.launch({channel:'chrome',headless:true});
const c=f.client(),user=await f.register(c,'picker-loading@local.test'),report={flows:[],errors:[],passed:false};
const field=(page,name)=>page.locator(`[data-teacher="${name}"]`);
const ready=page=>page.waitForFunction(()=>{const el=document.querySelector('[data-teacher="question"]');return el&&!el.disabled&&el.options.length>1;});
try{
 for(const language of ['chn','eng']){
  const context=await browser.newContext({viewport:{width:390,height:1000},reducedMotion:'reduce'});
  for(const [name,value] of c.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({id,language})=>{try{localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem(`ddphysics-tour:v4:${id}`,JSON.stringify({status:'skipped',version:4}));}catch{}},{id:user.id,language});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(f.base+'#ask');await page.locator('.tutoring-form select').first().selectOption('question');await field(page,'source').selectOption('textbook');await field(page,'question-book').selectOption('compulsory-2');
  let fail=true;
  await page.route('**/api/content/directory?*',async route=>{if(new URL(route.request().url()).searchParams.get('chapter')==='201'&&fail){fail=false;await route.fulfill({status:503,contentType:'application/json',body:'{}'});}else await route.continue();});
  await field(page,'question-chapter').selectOption('201');const retry=page.locator('.tutoring-form').getByRole('button',{name:language==='eng'?'Retry':'重试',exact:true});await retry.waitFor();assert.ok(await field(page,'question').isDisabled());await retry.click();await ready(page);assert.equal(await field(page,'question-chapter').inputValue(),'201');report.flows.push({language,flow:'failed-list/retry',passed:true});await page.unroute('**/api/content/directory?*');
  let delayedResolve;const delayed=new Promise(resolve=>delayedResolve=resolve);
  await page.route('**/api/content/directory?*',async route=>{if(new URL(route.request().url()).searchParams.get('chapter')==='202'){delayedResolve();await new Promise(resolve=>setTimeout(resolve,600));}try{await route.continue();}catch{}});
  await field(page,'question-chapter').selectOption('202');await delayed;await field(page,'question-chapter').selectOption('203');await ready(page);await page.waitForTimeout(700);const keys=await field(page,'question').locator('option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));assert.ok(keys.length&&keys.every(id=>id.startsWith('tb-203-')));assert.equal(await field(page,'question-chapter').inputValue(),'203');report.flows.push({language,flow:'rapid-chapter-change/no-stale-list',passed:true});await page.unroute('**/api/content/directory?*');
  await field(page,'question').selectOption(keys[0]);await page.locator('.ask-context button').click();await ready(page);await page.locator('.language-switch').click();await ready(page);assert.equal(await field(page,'source').inputValue(),'textbook');assert.equal(await field(page,'question-book').inputValue(),'compulsory-2');assert.equal(await field(page,'question-chapter').inputValue(),'203');assert.equal(await field(page,'question').inputValue(),keys[0]);report.flows.push({language,flow:'language-switch-preserves-location',passed:true});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'loading-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
console.log(JSON.stringify({flows:report.flows.length,passed:report.passed}));
