import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='http://127.0.0.1:5182';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 const email='rodrick_gao@163.com';
 const otp=await (await context.request.post(base+'/api/auth/code',{data:{email}})).json();
 const login=await (await context.request.post(base+'/api/auth/verify',{data:{email,code:otp.developmentCode}})).json();assert.ok(login.user);
 if(!login.user.profileComplete){const r=await context.request.put(base+'/api/profile',{data:{nickname:'习题功能测试',grade:'中五',target:'5',avatar:'newton-wave',password:'Study-pass-123',confirmPassword:'Study-pass-123'}});assert.ok(r.ok());}
 const membership=await (await context.request.get(base+'/api/membership')).json();
 if(!membership.membership.active){
  const key=fs.readFileSync('.local-exercise-qa/admin-key.txt','utf8').trim();
  assert.ok((await context.request.post(base+'/api/admin/login',{data:{key}})).ok());
  const grant=await context.request.post(base+'/api/admin/membership',{data:{userId:login.user.id,action:'extend',days:30,reason:'Isolated local exercise QA',revision:membership.membership.revision,requestId:crypto.randomUUID()}});assert.ok(grant.ok(),await grant.text());
 }
 const index=JSON.parse(fs.readFileSync('assets/textbook-exercises/index-chn.json','utf8'));
 const chapter=index.questions.filter(q=>q.chapter==='201').map(q=>q.id);
 const api=async(path,data)=>{const r=await context.request.put(base+'/api/'+path,{data});assert.ok(r.ok(),await r.text());return r.json();};
 await api('progress',{keys:[...chapter,'tb-202-1','2012|paper-1a|1'],status:'clear'});
 await context.addInitScript(()=>{localStorage.setItem('dse-physics-language-v1','chn');window.print=()=>{};});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=async()=>{await page.locator('[data-exercise][aria-busy="false"]').waitFor();};
 await page.goto(base+'/#exercises?question=tb-201-1');await ready();
 const actions=page.locator('.question-header-actions');
 await actions.getByRole('button',{name:/^(标为已掌握|已掌握 ✓)$/}).click();await page.waitForFunction(()=>document.querySelector('.question-header-actions button[aria-pressed]')?.getAttribute('aria-pressed')==='true');
 await page.reload();await ready();assert.equal(await actions.getByRole('button',{name:/^(标为已掌握|已掌握 ✓)$/}).getAttribute('aria-pressed'),'true');
 await actions.getByRole('button',{name:'加入错题',exact:true}).click();await actions.getByRole('button',{name:'已加入错题',exact:true}).waitFor();
 assert.equal(await actions.getByRole('button',{name:/^(标为已掌握|已掌握 ✓)$/}).getAttribute('aria-pressed'),'false');
 await page.locator('.exercise-chapter-progress button').click();
 await page.waitForFunction(()=>document.querySelector('.exercise-chapter-progress button')?.getAttribute('aria-pressed')==='true');
 assert.equal(await page.locator('#exercise-navigator .mastered').count(),chapter.length);
 let stored=await (await context.request.get(base+'/api/mistakes')).json();assert.ok(chapter.every(k=>stored.mastered[k]));assert.ok(!stored.mistakes['tb-201-1']);
 await page.locator('.exercise-chapter-progress button').click();await page.waitForFunction(()=>document.querySelector('.exercise-chapter-progress button')?.getAttribute('aria-pressed')==='false');
 // Insert reverse chronology and chapter order; UI and exports must use the same rules.
 for(const key of ['tb-201-12','tb-202-1','tb-201-2','tb-201-1','2012|paper-1a|1'])await api('mistakes',{key,marked:true});
 await page.reload();await ready();await page.locator('.nav-list button').filter({hasText:'错题库'}).click();
 await page.locator('[data-mistake]').first().waitFor();
 const expected=['2012|paper-1a|1','tb-201-2','tb-201-1','tb-202-1','tb-201-12'];
 assert.deepEqual(await page.locator('[data-mistake]').evaluateAll(nodes=>nodes.map(n=>n.dataset.mistake)),expected);
 fs.mkdirSync('../tmp/textbook-exercise-qa',{recursive:true});
 await page.screenshot({path:'../tmp/textbook-exercise-qa/mixed-mistakes.png',fullPage:true});
 for(const name of ['打印原题版','打印详解版']){
  const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name,exact:true}).click();const popup=await popupPromise;
  await popup.locator('.print-question').first().waitFor();
  assert.deepEqual(await popup.locator('.print-question').evaluateAll(nodes=>nodes.map(n=>n.dataset.question)),expected);
  if(name==='打印原题版'){assert.equal(await popup.locator('.answer-line,.answer-blank').count(),0);assert.equal(await popup.locator('.print-choice').count(),4);assert.equal(await popup.locator('.working-space').count(),1);}
  else {assert.match(await popup.locator('[data-question="tb-201-12"]').innerText(),/课本答案/);assert.ok(await popup.locator('[data-question="tb-201-12"] math').count());}
  await popup.close();
 }
 await page.locator('[data-mistake="tb-201-2"]').getByRole('button',{name:'打开',exact:true}).click();await ready();assert.equal(await page.locator('[data-exercise]').getAttribute('data-exercise'),'tb-201-2');
 await actions.getByRole('button',{name:'已加入错题',exact:true}).click();await actions.getByRole('button',{name:'加入错题',exact:true}).waitFor();
 await page.locator('.nav-list button').filter({hasText:'错题库'}).click();await page.getByRole('button',{name:'回收站',exact:true}).click();
 const row=page.locator('.mistake-trash .mistake-row').filter({hasText:'201 · Q2'});await row.getByRole('button',{name:'恢复',exact:true}).click();await row.waitFor({state:'detached'});
 await page.getByRole('button',{name:'错题库',exact:true}).click();await page.locator('[data-mistake="tb-201-2"]').waitFor();
 assert.deepEqual(await page.locator('[data-mistake]').evaluateAll(nodes=>nodes.map(n=>n.dataset.mistake)),expected);
 await page.locator('[data-mistake="tb-201-2"]').getByRole('button',{name:'打开',exact:true}).click();await ready();
 await page.setViewportSize({width:390,height:844});await page.locator('.exercise-workspace .mobile-picker').click();await page.locator('.exercise-chapter-progress button').waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:'../tmp/textbook-exercise-qa/progress-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: persisted mastery, whole chapter toggle, mistakes, shared mixed sorting, both print modes, restore timestamp, links, mobile');
}finally{await browser.close();}
