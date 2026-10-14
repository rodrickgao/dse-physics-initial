import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture,output} from './deep-test-fixture.mjs';

const f=await fixture('views'),browser=await chromium.launch({channel:'chrome',headless:true});
const report={views:[],failures:[],runtimeErrors:[],httpErrors:[]},users=[];
const modes=[{name:'desktop',width:1440,height:1000},{name:'ipad-landscape',width:1180,height:820,touch:true,dpr:2},{name:'ipad-portrait-dark',width:834,height:1194,touch:true,dpr:2,dark:true},{name:'phone',width:390,height:844,touch:true,mobile:true,dpr:2},{name:'narrow',width:320,height:740,touch:true,mobile:true}];
const routes=[['home','.home-view'],['bank','.question-bank-view'],['bank?q=heat','.bank-search-result'],['examples','.examples-view'],['examples?question=ex-101-1','[data-example][aria-busy="false"]'],['examples?question=ex-E301-1','[data-example][aria-busy="false"]'],['exercises','.exercises-view'],['exercises?question=tb-101-7','[data-exercise][aria-busy="false"]'],['exercises?question=tb-E201-1','[data-exercise][aria-busy="false"]'],['papers','.papers-view'],['papers?question=2025%7Cpaper-1a%7C1','[data-question][aria-busy="false"]'],['papers?question=2012%7Cpaper-2%7C1.3','[data-question][aria-busy="false"]'],['papers?question=2015%7Cpaper-1b%7C1','[data-question][aria-busy="false"]'],['textbook','.textbook-view'],['textbook?knowledge=2','[data-tour="knowledge-card"]'],['textbook?knowledge=48','[data-tour="knowledge-card"]'],['mistakes','[data-mistake]'],['membership','.home-view'],['payment','.home-view'],['ask','.tutoring-view'],['focus','.focus-view:not([hidden])'],['support','.support-view']];
const saved=['ex-101-1','ex-E301-1','tb-201-1','tb-E201-1','tb-E301-1','tb-101-7','2012|paper-1a|1','2012|paper-2|1.3','2015|paper-1b|1'];
async function check(page,label){
 const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,broken:[...document.querySelectorAll('main img')].filter(el=>el.getBoundingClientRect().width&&el.complete&&!el.naturalWidth).map(el=>el.src),heading:document.querySelector('main h1,main h2')?.textContent,accountOverlap:(()=>{const boxes=[...document.querySelector('.account-bar').children].map(node=>node.getBoundingClientRect()).filter(box=>box.width&&box.height);return boxes.some((a,i)=>boxes.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));})()}));
 assert.equal(result.overflow,false,label+' horizontal overflow');assert.deepEqual(result.broken,[],label+' broken images');assert.ok(result.heading,label+' missing heading');assert.equal(result.accountOverlap,false,label+' overlapping account controls');return result;
}
try {
 for(const state of ['none','active','expired','revoked']){
  const client=f.client(),user=await f.register(client,'views-'+state+'@local.test','深度检查 '+state);user.state=state;user.client=client;users.push(user);
  f.db.prepare('UPDATE users SET avatar=? WHERE id=?').run('newton-wave',user.id);
  if(state!=='none')f.db.prepare('INSERT INTO memberships VALUES(?,?,?,?)').run(user.id,f.clock()+(state==='expired'?-1:30*86400000),state==='revoked'?1:0,1);
  assert.equal((await client.call('mistakes/import',{keys:saved})).status,200);
 }
 for(const user of users)for(const language of ['chn','eng'])for(const mode of modes){
  const context=await browser.newContext({viewport:{width:mode.width,height:mode.height},reducedMotion:'reduce',hasTouch:Boolean(mode.touch),isMobile:Boolean(mode.mobile),deviceScaleFactor:mode.dpr||1});
  await context.addCookies([{name:'dse_session',value:user.client.jar.get('dse_session'),url:f.base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({id,language,dark})=>{try{localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem('dse-physics-theme-v1',dark?'dark':'light');localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped'}));}catch{}},{id:user.id,language,dark:Boolean(mode.dark)});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.runtimeErrors.push({state:user.state,language,mode:mode.name,error:e.message}));
  page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({state:user.state,language,mode:mode.name,status:r.status(),path:new URL(r.url()).pathname});});
  for(const [route,selector] of routes){
   const label=user.state+'/'+language+'/'+mode.name+'/'+route;f.advance(61000);
   try {
    await page.goto(f.base+'#'+(route==='bank?q=heat'&&language==='chn'?'bank?q='+encodeURIComponent('热'):route));await page.locator(selector).first().waitFor();
    if(route==='ask')assert.equal(await page.locator('.tutoring-form').count(),1);
    if(route==='mistakes'){assert.equal(await page.locator('[data-mistake]').count(),saved.length);assert.equal(await page.locator('#statistics-book').count(),1);}
    if(route.includes('?question=')&&route.startsWith('papers')){const solution=page.locator('[data-tour="paper-solution"]');await solution.click();const detailed=page.locator('[aria-controls="reasoning-stage"]');assert.equal(await detailed.isDisabled(),false);{await detailed.click();await page.locator('#reasoning-stage .study-content').waitFor();}}
    if(route.includes('?question=')&&route.startsWith('exercises')){await page.locator('.stage-toggle').first().click();const detail=page.locator('.stage-toggle').nth(1);if(await detail.count()){assert.equal(await detail.isDisabled(),false);{await detail.click();await page.locator('.reasoning-content').waitFor();}}}
    assert.doesNotMatch(await page.locator('body').innerText(),/会员|Membership|必修一免费/i,label);assert.equal(await page.locator('.member-notice,.qdna-membership-lock').count(),0);const result=await check(page,label);report.views.push({label,...result,passed:true});
    if(user.state==='active'&&language==='chn'&&route==='mistakes'&&mode.name==='desktop')await page.screenshot({path:path.join(output,'deep-member-mistakes.png')});
   }catch(error){console.log('FAIL '+label+': '+error.message);report.failures.push({label,error:error.message});if(report.failures.length<=8)await page.screenshot({path:path.join(output,'view-failure-'+report.failures.length+'.png')});}
  }
  try{await page.locator('.account-settings').click();await page.locator('.profile-embedded').waitFor();report.views.push({label:user.state+'/'+language+'/'+mode.name+'/profile',...await check(page,'profile'),passed:true});}catch(error){report.failures.push({label:user.state+'/'+language+'/'+mode.name+'/profile',error:error.message});}
  fs.writeFileSync(path.join(output,'view-matrix-report.json'),JSON.stringify(report,null,2));await context.close();console.log('Checked '+user.state+' '+language+' '+mode.name+' ('+report.views.length+' passed)');
 }
 const admin=f.client();assert.equal((await admin.call('admin/login',{key:'isolated-deep-test-key'})).status,200);
 for(const language of ['chn','eng'])for(const mode of modes){
  const context=await browser.newContext({viewport:{width:mode.width,height:mode.height},hasTouch:Boolean(mode.touch),reducedMotion:'reduce'});await context.addCookies([{name:'dse_admin_session',value:admin.jar.get('dse_admin_session'),url:f.base,httpOnly:true,sameSite:'Strict'}]);await context.addInitScript(language=>localStorage.setItem('dse-physics-language-v1',language),language);
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.runtimeErrors.push({state:'admin',error:e.message}));
  for(const route of ['overview','users','questions','visits','tutoring','payments','activity','audit']){
   const label='admin/'+language+'/'+mode.name+'/'+route;try {await page.goto(f.base+'admin.html#'+route);await page.locator('.management-shell').waitFor();await page.locator('main header h1').waitFor();if(route==='overview'){assert.equal(await page.locator('.admin-overview-students .metrics>div').count(),6);assert.equal(await page.locator('.admin-overview-membership .metrics>div').count(),0);}else await page.locator('main .panel').first().waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'admin overflow');report.views.push({label,passed:true});}catch(error){report.failures.push({label,error:error.message});}
  }
  await context.close();
 }
 report.passed=report.failures.length===0&&report.runtimeErrors.length===0;console.log(JSON.stringify({views:report.views.length,failures:report.failures,runtimeErrors:report.runtimeErrors,httpErrors:report.httpErrors,passed:report.passed}));
}finally{fs.writeFileSync(path.join(output,'view-matrix-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
