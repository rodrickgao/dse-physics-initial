import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';

const output=path.resolve(process.env.DSE_MOTION_OUTPUT||'../output/free-site-20261014/motion');fs.mkdirSync(output,{recursive:true});
const f=await fixture('site-motion'),browser=await chromium.launch({channel:'chrome',headless:true});
const member=f.client(),user=await f.register(member,'site-motion@local.test');
f.db.prepare('INSERT INTO memberships VALUES(?,?,0,1)').run(user.id,f.clock()+30*86400000);
const saved=['tb-101-1','tb-102-1','tb-201-1','tb-401-1','tb-501-1','ex-101-1','ex-E301-1','2012|paper-1a|1'];
assert.equal((await member.call('mistakes/import',{keys:saved})).status,200);
const before=(await member.call('mistakes')).data;
const admin=f.client();assert.equal((await admin.call('admin/login',{key:'isolated-deep-test-key'})).status,200);
const section=process.env.DSE_MOTION_QA_SECTION;
const report=section?JSON.parse(fs.readFileSync(path.join(output,'browser-report.json'),'utf8')):{students:[],admins:[],auth:[],errors:[]};delete report.failure;let lastPage;
if(section){report.resolvedErrors=[...(report.resolvedErrors||[]),...report.errors];report.errors=[];}
async function makeContext(language,mode,reduced,client=member){
 f.advance(61000);
 const context=await browser.newContext({viewport:mode,hasTouch:mode.width<1100,reducedMotion:reduced?'reduce':'no-preference'});
 if(client)for(const [name,value]of client.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
 await context.addInitScript(({language,id})=>{
  localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped',lastCompleted:-1,skippedSteps:[],pages:{}}));
  window.__motions=[];window.__motionCollisions=[];
  const original=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){
   if(this.parentElement?.closest('[data-motion-active]'))window.__motionCollisions.push(this.className);
   window.__motions.push({type:'waapi',target:this.className||this.id,duration:options.duration,frames,time:performance.now()});
   return original.call(this,frames,options);
  };
  document.addEventListener('animationstart',event=>{const duration=Math.max(...getComputedStyle(event.target).animationDuration.split(',').map(s=>parseFloat(s)*1000));window.__motions.push({type:'css',target:event.target.className,name:event.animationName,duration,time:performance.now()});},true);
 },{language,id:user.id});
 const page=await context.newPage();lastPage=page;page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));
 return {context,page};
}
async function check(page,label,action,ready,reduced,steps,{animated=true}={}){
 const start=await page.evaluate(()=>window.__motions.length);
 await action();if(ready)await page.locator(ready).first().waitFor();
 await page.waitForTimeout(260);
 const status=await page.evaluate(start=>({motions:window.__motions.slice(start).filter(m=>m.duration>1),collisions:window.__motionCollisions,active:document.querySelectorAll('[data-motion-active]').length,overflow:document.documentElement.scrollWidth>innerWidth+2,opacity:document.querySelector('[data-motion-surface="page"]')?getComputedStyle(document.querySelector('[data-motion-surface="page"]')).opacity:'1'}),start);
 assert.deepEqual(status.collisions,[],label+' nested reveal');assert.equal(status.active,0,label+' stale animation');assert.equal(status.opacity,'1',label+' stale opacity');assert.equal(status.overflow,false,label+' horizontal overflow');
 if(reduced)assert.equal(status.motions.length,0,label+' reduced motion');else if(animated)assert.ok(status.motions.length,label+' missing reveal');
 for(const motion of status.motions.filter(m=>m.type==='waapi')){assert.equal(motion.duration,200);assert.ok(motion.frames.every(frame=>Object.keys(frame).every(k=>k==='opacity')));}
 steps.push({label,animations:status.motions.map(m=>({type:m.type,target:m.target,name:m.name,duration:m.duration})),passed:true});
}
async function nav(page,id){
 const ids=['home','bank','textbook','mistakes','ask'],index=ids.indexOf(id);
 const desktop=page.locator('.sidebar .nav-item').nth(index);
 if(await desktop.isVisible())return desktop.click();
 if(index<4)return page.locator('.compact-mobile-nav>button').nth(index).click();
 await page.locator('.compact-mobile-nav>button').nth(4).click();
 return page.locator('#mobile-more-menu>button').nth(index-4).click();
}
try{
 for(const language of section?[]:['chn','eng'])for(const mode of [{width:1440,height:1000},{width:1024,height:768},{width:390,height:844},{width:320,height:740}])for(const reduced of [false,true]){
  const {context,page}=await makeContext(language,mode,reduced);const steps=[];const en=language==='eng',label=(zh,eng)=>en?eng:zh;
  await page.goto(f.base+'#home');await page.locator('.home-view').waitFor();await page.waitForTimeout(350);
  if(await page.locator('.student-topic-disclosure button').count()){
   await check(page,'home topics expand',()=>page.locator('.student-topic-disclosure button').click(),'.student-weak-points',reduced,steps);
   await check(page,'home topics collapse',()=>page.locator('.student-topic-disclosure button').click(),'.student-weak-points',reduced,steps);
  }
  await check(page,'question bank navigation',()=>nav(page,'bank'),'.question-bank-view',reduced,steps);
  await check(page,'examples directory',()=>page.locator('[data-tour="bank-examples"]').click(),'.examples-view .book-card',reduced,steps);
  await check(page,'examples book',()=>page.locator('.examples-view .book-card').first().click(),'.examples-view .exercise-directory button',reduced,steps);
  await check(page,'example loaded',()=>page.locator('.examples-view .exercise-directory button').first().click(),'[data-example][aria-busy="false"]',reduced,steps);
  await check(page,'example solution',()=>page.locator('[data-tour="example-solution"]').click(),'.examples-view .study-stage:nth-of-type(2)',reduced,steps);
  await check(page,'next example',()=>page.locator('[data-tour="example-next"]').click(),'[data-example][aria-busy="false"]',reduced,steps);
  await check(page,'previous example',()=>page.locator('.exercise-paging button').first().click(),'[data-example][aria-busy="false"]',reduced,steps);
  const exampleImage=page.locator('.examples-view .study-content img').first();
  if(await exampleImage.count()){
   await check(page,'example diagram zoom',()=>exampleImage.click(),'.study-image-dialog[open]',reduced,steps);
   await page.locator('.study-image-dialog').getByRole('button',{name:label('关闭','Close'),exact:false}).click();
   assert.ok(await exampleImage.evaluate(n=>n===document.activeElement));
  }
  await check(page,'knowledge from example',()=>page.locator('[data-tour="question-knowledge"]').first().click(),'[data-tour="knowledge-card"]',reduced,steps);
  await check(page,'return to example',()=>page.locator('.reader-return').click(),'[data-example][aria-busy="false"]',reduced,steps);
  await check(page,'bank from breadcrumb',()=>page.locator('.exercise-breadcrumb button').first().click(),'.question-bank-view',reduced,steps);
  await check(page,'exercise directory',()=>page.locator('[data-tour="bank-exercises"]').click(),'.exercises-view .book-card',reduced,steps);
  await check(page,'exercise book',()=>page.locator('.exercises-view .book-card').first().click(),'.exercise-directory button',reduced,steps);
  await check(page,'exercise loaded',()=>page.locator('.exercise-directory button').first().click(),'[data-exercise][aria-busy="false"]',reduced,steps);
  await check(page,'exercise answer',()=>page.locator('.study-flow>.stage-toggle').click(),'.study-flow>.study-stage:nth-of-type(2)',reduced,steps);
  await check(page,'next exercise',()=>page.locator('.exercise-paging button').last().click(),'[data-exercise][aria-busy="false"]',reduced,steps);
  await check(page,'previous exercise',()=>page.locator('.exercise-paging button').first().click(),'[data-exercise][aria-busy="false"]',reduced,steps);
  await check(page,'bank from exercise',()=>page.locator('.exercise-breadcrumb button').first().click(),'.question-bank-view',reduced,steps);
  await check(page,'past papers directory',()=>page.locator('[data-tour="bank-papers"]').click(),'.year-directory-card',reduced,steps);
  await check(page,'past paper year',()=>page.locator('.year-directory-card').first().click(),'[data-question][aria-busy="false"]',reduced,steps);
  await check(page,'past paper answer',()=>page.locator('[data-tour="paper-solution"]').click(),'#official-stage',reduced,steps);
  await check(page,'past paper explanation',()=>page.locator('#official-stage .stage-toggle').click(),'#reasoning-stage',reduced,steps);
  await check(page,'next past paper question',()=>page.locator('.question-footer button').last().click(),'[data-question][aria-busy="false"]',reduced,steps);
  await check(page,'past paper section',async()=>{if(!(await page.locator('.paper-choice-list').isVisible()))await page.locator('.mobile-picker').click();await page.locator('.paper-choice-list button').nth(1).click();},'[data-question][aria-busy="false"]',reduced,steps);
  await check(page,'knowledge directory navigation',()=>nav(page,'textbook'),'.book-card',reduced,steps);
  await check(page,'knowledge book',()=>page.locator('.textbook-view .book-card').first().click(),'.knowledge-browser-content',reduced,steps);
  await check(page,'knowledge chapter',()=>page.locator('.chapter-list button').nth(2).click(),'.knowledge-browser-content',reduced,steps);
  const image=page.locator('.textbook-image-button').first();
  if(await image.count()){
   await check(page,'knowledge image modal',()=>image.click(),'.textbook-image-dialog[open]',reduced,steps);
   await page.locator('.textbook-image-dialog[open]').getByRole('button',{name:label('关闭图片','Close image'),exact:true}).click();
  }
  await check(page,'knowledge directory return',()=>page.locator('.back-books').click(),'.book-card',reduced,steps);
  await check(page,'mistakes navigation',()=>nav(page,'mistakes'),'#statistics-book',reduced,steps);
  await check(page,'mistakes book filter',()=>page.locator('#statistics-book').selectOption('compulsory-1'),'#statistics-book',reduced,steps);
  await check(page,'mistakes all filter',()=>page.locator('#statistics-book').selectOption('all'),'#statistics-book',reduced,steps);
  await check(page,'mistakes recycle bin',()=>page.locator('[data-tour="mistake-trash-tab"]').click(),'[data-tour="mistake-trash"][data-ready="true"]',reduced,steps);
  await check(page,'mistakes return',()=>page.locator('[data-tour="mistake-active-tab"]').click(),'#statistics-book',reduced,steps);
  
  await check(page,'ask a teacher navigation',()=>nav(page,'ask'),'.tutoring-form',reduced,steps);
  await check(page,'support navigation',()=>page.locator('.top-support').click(),'.support-view',reduced,steps);
  await check(page,'focus timer navigation',()=>page.locator('.timer-open:visible').first().click(),'.focus-view:not([hidden])',reduced,steps);
  await check(page,'profile settings',()=>page.locator('.account-settings').click(),'.profile-embedded',reduced,steps);
  await check(page,'profile return',()=>page.locator('.profile-header').getByRole('button',{name:label('返回','Back'),exact:true}).click(),'.focus-view:not([hidden])',reduced,steps);
  await check(page,'search bank navigation',()=>nav(page,'bank'),'.question-bank-view',reduced,steps);
  await check(page,'search results reveal',()=>page.locator('#bank-search').fill(label('热','heat')),'.bank-search-result',reduced,steps);
  assert.ok(await page.locator('#bank-search').evaluate(n=>n===document.activeElement));
  if(await page.locator('.search-more').last().isVisible())await check(page,'search next results',()=>page.locator('.search-more').last().click(),'.bank-search-result',reduced,steps);
  // Interrupt an in-flight reveal and finish on the most recent page.
  await nav(page,'textbook');await page.locator('.book-card').first().click();await page.locator('.chapter-list').waitFor();
  await page.locator('.chapter-list').evaluate(n=>{n.querySelectorAll('button')[2].click();n.querySelectorAll('button')[3].click();n.querySelectorAll('button')[1].click();});
  await page.waitForTimeout(300);assert.equal(await page.locator('.knowledge-browser-content').evaluate(n=>getComputedStyle(n).opacity),'1');
  assert.equal(await page.locator('[data-motion-active]').count(),0);
  assert.deepEqual((await member.call('mistakes')).data,before);
  if(language==='chn'&&!reduced&&(mode.width===1440||mode.width===390))await page.screenshot({path:path.join(output,`student-${mode.width}.png`)});
  report.students.push({language,...mode,reduced,steps,rapidSwitch:true,preservedLearningRecords:true,passed:true});
  console.log(`PASS student ${language} ${mode.width} ${reduced?'reduced':'animated'} ${steps.length}`);await context.close();
 }
 for(const language of section==='admin-english'?['eng']:section==='auth'?[]:['chn','eng'])for(const mode of [{width:1440,height:1000},{width:390,height:844}])for(const reduced of [false,true]){
  const {context,page}=await makeContext(language,mode,reduced,admin),steps=[];
  await page.goto(f.base+'admin.html');await page.locator('.management-shell').waitFor();await page.waitForTimeout(350);
  for(const [index,id]of ['overview','tutoring','users','questions','visits','activity','overview'].entries()){
   const navIndex=['overview','tutoring','users','questions','visits','activity'].indexOf(id);
   if(index===0)continue;
   await check(page,'admin '+id,()=>page.locator('.management-shell>aside nav button').nth(navIndex).click(),'.management-shell>main>header h1',reduced,steps);
  }
  await check(page,'admin student list',()=>page.locator('.management-shell>aside nav button').nth(2).click(),'.panel table tbody tr',reduced,steps);
  await check(page,'admin student detail',()=>page.locator('.panel').getByRole('button',{name:/Profile/i}).first().click(),'.admin-learning',reduced,steps);
  for(const index of [1,2,3,0])await check(page,'admin learning tab '+index,()=>page.locator('.learning-tabs button').nth(index).click(),'#learning-records',reduced,steps);
  assert.deepEqual((await member.call('mistakes')).data,before);
  report.admins.push({language,...mode,reduced,steps,passed:true});console.log(`PASS admin ${language} ${mode.width} ${reduced?'reduced':'animated'}`);await context.close();
 }
 for(const language of ['chn','eng'])for(const mode of [{width:1440,height:1000},{width:390,height:844}])for(const reduced of [false,true]){
  const {context,page}=await makeContext(language,mode,reduced,null),steps=[];const en=language==='eng';
  await page.goto(f.base);await page.locator('.welcome-actions').waitFor();await page.waitForTimeout(600);
  await check(page,'welcome to login',()=>page.locator('.welcome-actions button').first().click(),'.auth-card',reduced,steps);
  await check(page,'password login mode',()=>page.locator('.login-methods button').first().click(),'input[type="password"]',reduced,steps);
  await check(page,'code login mode',()=>page.locator('.login-methods button').last().click(),'.auth-code',reduced,steps);
  await check(page,'login to registration',()=>page.locator('.auth-account-switch').click(),'.auth-card',reduced,steps);
  await check(page,'registration to login',()=>page.locator('.auth-account-switch').click(),'.login-methods',reduced,steps);
  await page.locator('.login-methods button').first().click();await page.locator('#login-email').fill('site-motion@local.test');await page.locator('input[type="password"]').fill('Deep-local-test-123');
  await check(page,'login to learning',()=>page.locator('.auth-submit').click(),'.home-view .student-weak-points',reduced,steps);
  await page.goto(f.base+'#payment');await page.locator('.home-view').waitFor();assert.equal(await page.locator('.payment-view').count(),0);steps.push({label:'disabled payment route returns home',passed:true});
  report.auth.push({language,...mode,reduced,steps,noPaymentSubmitted:true,passed:true});console.log(`PASS auth ${language} ${mode.width} ${reduced?'reduced':'animated'}`);await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw error;}
finally{fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
