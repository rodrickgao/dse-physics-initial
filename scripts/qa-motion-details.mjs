import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';
const output=path.resolve('../output/site-motion-20261014/details');fs.mkdirSync(output,{recursive:true});
const f=await fixture('motion-details'),browser=await chromium.launch({channel:'chrome',headless:true});
const member=f.client(),user=await f.register(member,'motion-details@local.test');
f.db.prepare('INSERT INTO memberships VALUES(?,?,0,1)').run(user.id,f.clock()+30*86400000);
await member.call('mistakes/import',{keys:['tb-101-1','tb-102-1','tb-501-1']});
const before=(await member.call('mistakes')).data,admin=f.client();await admin.call('admin/login',{key:'isolated-deep-test-key'});
const report={views:[],errors:[]};let lastPage;
try{
 for(const language of ['chn','eng'])for(const width of [1440,390])for(const reduced of [false,true]){
  f.advance(61000);const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<1000,reducedMotion:reduced?'reduce':'no-preference'});
  for(const[name,value]of member.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({id,language})=>{localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped'}));window.__motions=[];const original=Element.prototype.animate;Element.prototype.animate=function(frames,options){window.__motions.push({target:this.className,duration:options.duration,frames});return original.call(this,frames,options);};},{id:user.id,language});
  const page=await context.newPage();lastPage=page;page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));const steps=[];
  async function check(label,action,selector){const count=await page.evaluate(()=>window.__motions.length);await action();if(selector)await page.locator(selector).first().waitFor();await page.waitForTimeout(280);const motions=await page.evaluate(count=>window.__motions.slice(count),count);if(reduced)assert.equal(motions.length,0,label);else assert.ok(motions.length,label);assert.equal(await page.locator('[data-motion-active]').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));steps.push({label,motions,passed:true});}
  await page.goto(f.base);await page.locator('.home-view').waitFor();await page.waitForTimeout(300);
  await check('profile navigation',()=>page.locator('.account-settings').click(),'.profile-embedded');
  await check('avatar picker',()=>page.locator('.profile-camera').click(),'.profile-avatar-panel:not([hidden])');
  await check('physicist change',()=>page.locator('.physicist-tabs button').nth(1).click(),'.avatar-options');
  await check('avatar upload panel',()=>page.locator('.avatar-mode button').last().click(),'.avatar-upload');
  await check('avatar preset panel',()=>page.locator('.avatar-mode button').first().click(),'.avatar-options');
  await page.locator('.profile-picker-close').click();assert.ok(await page.locator('.profile-camera').evaluate(n=>n===document.activeElement));
  await page.goto(f.base+'#mistakes');await page.locator('#statistics-book').waitFor();await page.waitForTimeout(300);
  await check('chapter filter question reveal',()=>page.locator('.statistics-chapter-list button').first().click(),'[data-mistake]');
  if(!reduced)assert.ok(steps.at(-1).motions.some(m=>m.target==='mistake-question-panel'));
  await check('all filter question reveal',()=>page.locator('#statistics-book').selectOption('all'),'[data-mistake]');
  // Loading is deliberately delayed; the incoming reader animates when its data is ready.
  await page.route('**/api/content/question?*',async route=>{await new Promise(resolve=>setTimeout(resolve,600));return route.continue();});
  await check('delayed example reveal',()=>page.goto(f.base+'#examples?question=ex-101-1'),'.examples-view[data-ready="true"]');
  await check('delayed next example reveal',()=>page.locator('[data-tour="example-next"]').click(),'.examples-view[data-ready="true"][data-question="ex-101-2"]');
  await page.unroute('**/api/content/question?*');
  await page.goto(f.base+'#papers');await page.locator('.year-directory-card').first().waitFor();await page.locator('.year-directory-card').filter({hasText:'2019'}).click();await page.locator('[data-question][aria-busy="false"]').waitFor();await page.waitForTimeout(300);
  await check('candidate report reveal',async()=>{if(!(await page.locator('.paper-choice-list').isVisible()))await page.locator('.mobile-picker').click();await page.locator('.paper-choice-list button').nth(3).click();},'.scan-stack img');
  await check('candidate report next page',()=>page.locator('.question-footer button').last().click(),'.scan-stack img');
  if(!reduced){
   await page.goto(f.base+'#textbook');await page.locator('.book-card').first().click();await page.locator('.chapter-list').waitFor();await page.locator('.chapter-list button').nth(2).click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(50);assert.equal(await page.locator('[data-motion-active]').count(),0);assert.equal(await page.locator('.knowledge-browser-content').evaluate(n=>getComputedStyle(n).opacity),'1');await page.emulateMedia({reducedMotion:'no-preference'});
  }
  const adminContext=await browser.newContext({viewport:{width,height:900},reducedMotion:reduced?'reduce':'no-preference'});
  for(const[name,value]of admin.jar)await adminContext.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
  await adminContext.addInitScript(language=>{localStorage.setItem('dse-physics-language-v1',language);window.__motions=[];const original=Element.prototype.animate;Element.prototype.animate=function(frames,options){window.__motions.push({target:this.className,duration:options.duration,frames});return original.call(this,frames,options);};},language);
  const studentPage=page,adminPage=await adminContext.newPage();lastPage=adminPage;adminPage.on('pageerror',e=>report.errors.push(e.message));
  await adminPage.goto(f.base+'admin.html#tutoring');await adminPage.locator('.tutoring-view select').waitFor();await adminPage.waitForTimeout(300);
  for(const value of ['answered','all','pending']){const count=await adminPage.evaluate(()=>window.__motions.length);await adminPage.locator('.tutoring-view select').selectOption(value);await adminPage.waitForTimeout(280);const motions=await adminPage.evaluate(count=>window.__motions.slice(count),count);assert.equal(motions.length>0,!reduced);steps.push({label:'teacher reply filter '+value,motions,passed:true});}
  await adminPage.locator('.management-shell>aside nav button').nth(3).click();await adminPage.locator('.admin-insights tbody tr').first().waitFor();await adminPage.waitForTimeout(300);
  const count=await adminPage.evaluate(()=>window.__motions.length);await adminPage.locator('.admin-insights select').selectOption('active');await adminPage.waitForTimeout(280);const motions=await adminPage.evaluate(count=>window.__motions.slice(count),count);assert.equal(motions.length>0,!reduced);steps.push({label:'admin question sort',motions,passed:true});
  await adminContext.close();assert.deepEqual((await member.call('mistakes')).data,before);
  report.views.push({language,width,reduced,steps,dynamicReducedMotion:true,learningRecordsUnchanged:true,passed:true});console.log(`PASS details ${language} ${width} ${reduced?'reduced':'animated'}`);await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(output,'failure.png')});throw error;}
finally{fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
