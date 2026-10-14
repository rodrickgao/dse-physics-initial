import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';
const out=path.resolve(process.env.DSE_OFFICIAL_QA_OUT||'../output/official-2025-20261012');
fs.mkdirSync(out,{recursive:true});
const f=await fixture('official-2025'),browser=await chromium.launch({channel:'chrome',headless:true});
const report={views:[],errors:[],failures:[],apiEditions:0,passed:false};
const member=f.client(),memberUser=await f.register(member,'official-2025-member@local.test');f.db.prepare('INSERT INTO memberships VALUES(?,?,0,1)').run(memberUser.id,f.clock()+30*86400000);
const free=f.client(),freeUser=await f.register(free,'official-2025-free@local.test');
const english=JSON.parse(fs.readFileSync('text-papers/2025-eng.json'));
const chinese=JSON.parse(fs.readFileSync('text-papers/2025-chn.json'));
const keys=Object.keys(english).filter(key=>key.includes('|paper-1b|')||key.endsWith('.S'));
const snapshot=()=>Object.fromEntries(['mistakes','mastered','mistake_archive','question_status_events','focus_sessions'].map(table=>[table,f.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));const before=snapshot();
try{
 for(const language of ['chn','eng']){
  const original=JSON.parse(fs.readFileSync(`text-papers/2025-${language}.json`));
  for(const key of Object.keys(original)){
   f.advance(61000);const result=await member.call('content/question?'+new URLSearchParams({id:key,language}));assert.equal(result.status,200,key);assert.ok(result.data.officialScreenshot);report.apiEditions++;
  }
 }
 for(const state of ['member','free'])for(const language of ['chn','eng'])for(const [mode,width,height]of [['desktop',1440,1000],['ipad',834,1194],['phone',390,844]]){
  const client=state==='member'?member:free,user=state==='member'?memberUser:freeUser;
  const context=await browser.newContext({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000,deviceScaleFactor:2,reducedMotion:'reduce'});
  for(const [name,value]of client.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({language,id})=>{localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped'}));},{language,id:user.id});
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>report.errors.push(error.message));
  for(const key of state==='member'?keys:['2025|paper-1b|5','2025|paper-1b|8']){
   f.advance(61000);
   try{
    await page.goto(f.base+'#papers?question='+encodeURIComponent(key));await page.locator('[data-question][aria-busy="false"]').waitFor();
    const toggle=page.locator('[data-tour="paper-solution"]');if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
    const images=page.locator('#official-stage .official-content img');await images.first().waitFor();
    const displayed=language==='chn'?chinese[key].officialScreenshot:english[key].officialOriginal;
    const expected=[...displayed.matchAll(/src="([^"]+)"/g)].map(match=>createHash('sha256').update(fs.readFileSync(match[1])).digest('hex'));
    assert.equal(await images.count(),expected.length,key);
    for(let i=0;i<expected.length;i++){
     const img=images.nth(i);await img.evaluate(async el=>{el.loading='eager';await el.decode();});
     const metrics=await img.evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,naturalWidth:el.naturalWidth,naturalHeight:el.naturalHeight,src:el.src,objectFit:getComputedStyle(el).objectFit};});
     assert.ok(metrics.naturalWidth>0&&metrics.naturalHeight>0);assert.ok(Math.abs(metrics.width/metrics.height-metrics.naturalWidth/metrics.naturalHeight)<.015,'image aspect ratio preserved');
     const bytes=await(await context.request.get(metrics.src)).body();assert.equal(createHash('sha256').update(bytes).digest('hex'),expected[i]);
     if(key==='2025|paper-1b|8')assert.ok(metrics.naturalHeight>800,'Q8 includes calculations below the flux graphs');
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'no horizontal overflow');
    if(process.env.DSE_CHECK_MEMBER_LEFT){
     const position=await page.locator('.account-bar').evaluate(el=>{const status=el.querySelector('.membership-status'),r=el.getBoundingClientRect(),s=status.getBoundingClientRect(),settings=el.querySelector('.account-settings').getBoundingClientRect(),css=getComputedStyle(el);return {statusOffset:s.left-r.left-parseFloat(css.paddingLeft),textAlign:getComputedStyle(status).textAlign,settingsOffset:r.right-parseFloat(css.paddingRight)-settings.right,first:el.firstElementChild===status};});
     assert.ok(position.first&&Math.abs(position.statusOffset)<2&&position.textAlign==='left','membership stays left');
     assert.ok(Math.abs(position.settingsOffset)<2,'account settings stay right');
    }
    if(['2025|paper-1b|5','2025|paper-1b|8'].includes(key)){
     await page.evaluate(()=>scrollTo(0,0));await page.locator('.account-bar').screenshot({path:path.join(out,`header-${state}-${language}-${mode}.png`)});
     await page.locator('#official-stage').screenshot({path:path.join(out,`q${key.endsWith('|5')?'5':'8'}-${state}-${language}-${mode}.png`)});
     await images.first().click();await page.locator('.study-image-dialog[open]').waitFor();await page.locator('.study-image-dialog button').filter({hasText:language==='eng'?'Close':'关闭'}).click();await page.locator('.study-image-dialog').waitFor({state:'hidden'});
    }
    report.views.push({state,language,mode,key,passed:true});
   }catch(error){report.failures.push({state,language,mode,key,error:error.stack});await page.screenshot({path:path.join(out,`failure-${report.failures.length}.png`)}).catch(()=>{});}
  }
  await context.close();console.log(state,language,mode,'complete');
 }
 assert.deepEqual(snapshot(),before,'reading and enlarging official screenshots do not change student learning state');
 report.learningStatePreserved=true;report.passed=report.errors.length===0&&report.failures.length===0;console.log(JSON.stringify({views:report.views.length,apiEditions:report.apiEditions,failures:report.failures,errors:report.errors,passed:report.passed}));
}finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();const root=path.resolve(process.env.TEMP||process.env.TMP),target=path.resolve(f.directory);if(!target.startsWith(root+path.sep)||!path.basename(target).startsWith('ddphysics-deep-official-2025-'))throw Error('Unexpected test directory');fs.rmSync(target,{recursive:true});}
