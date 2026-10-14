import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {createApi} from '../server/api.mjs';
import {GRADES,TARGETS,AVATAR_IDS} from '../src/lib/avatar-catalog.js';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const directory=fs.mkdtempSync(join(tmpdir(),'ddphysics-tour-v2-')),out='../output/deep-site-test-20261012/tours';
fs.mkdirSync(out,{recursive:true});const api=createApi({directory,qdnaDirectory:resolve('../output/qdna-20261008')});
const root=resolve('dist');const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer((req,res)=>api.handler(req,res,()=>{if(api.protectFiles(req,res))return;try{const pathname=new URL(req.url,'http://localhost').pathname;const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root)||!fs.statSync(file).isFile())throw Error();res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end();}}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{
for(const language of (process.env.DSE_TOUR_QA_LANGUAGE?[process.env.DSE_TOUR_QA_LANGUAGE]:['chn','eng'])){
 const mobile=language==='eng',context=await browser.newContext({viewport:mobile?{width:320,height:740}:{width:1440,height:1000},reducedMotion:mobile?'reduce':'no-preference'});
 const email=`tour-${language}@local.test`,code=await(await context.request.post(base+'/api/auth/code',{data:{email}})).json();
 const auth=await(await context.request.post(base+'/api/auth/verify',{data:{email,code:code.developmentCode}})).json();assert.ok(auth.user);
 const password='Local-test-'+crypto.randomUUID();const profile=await context.request.put(base+'/api/profile',{data:{nickname:'Tour QA',grade:GRADES[0],target:TARGETS[0],avatar:[...AVATAR_IDS][0],password,confirmPassword:password}});assert.equal(profile.status(),200);
 const page=await context.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='PUT'&&r.url().endsWith('/api/mistakes'))writes.push(r.postDataJSON());});
 await page.addInitScript(lang=>localStorage.setItem('dse-physics-language-v1',lang),language);
 const target=id=>page.locator(`[data-tour="${id}"]`).first(),step=id=>page.locator(`[data-tour-step="${id}"]`);
 const text=(zh,en)=>mobile?en:zh;
 async function ready(id){await step(id).waitFor();await page.waitForTimeout(650);const b=await step(id).boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=(mobile?321:1441)&&b.y+b.height<=(mobile?741:1001),id);}
 await page.goto(base);await step('welcome').waitFor();await step('welcome').getByRole('button',{name:text('开始体验','Start exploring'),exact:true}).click();
 await ready('open');await target('example-chapter-101').click();await ready('solution');await target('example-solution').click();await ready('mastered');await target('mark-mastered').click();await ready('mark');assert.equal(await step('mark').locator('footer button').count(),2);assert.equal(await step('mark').getByRole('button',{name:text('下一步','Next'),exact:true}).isDisabled(),true);
 if(!mobile){await page.route('**/api/mistakes',r=>r.request().method()==='PUT'?r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Please retry'})}):r.continue());await target('mark-mistake').click();await page.waitForTimeout(650);assert.equal(await step('mark').count(),1);await page.unroute('**/api/mistakes');}
 await target('mark-mistake').click();await ready('mistake-review');assert.ok(page.url().endsWith('#mistakes'));
 const saved=await(await context.request.get(base+'/api/mistakes')).json();assert.ok(saved.mistakes['ex-101-1']);
 await page.reload();await step('welcome').waitFor();await step('welcome').getByRole('button',{name:text('继续教程','Resume tour'),exact:true}).click();await ready('mistake-review');
 await target('tour-mistake-open').click();await ready('question-knowledge');await target('question-knowledge').click();await ready('knowledge-question');
 await page.screenshot({path:`${out}/v2-${language}-knowledge.png`});
 await target('knowledge-question-2').click();await ready('analysis-open');assert.ok(page.url().endsWith('#home'));
 await step('analysis-open').getByRole('button',{name:text('下一步','Next'),exact:true}).click();await ready('analysis-report');await step('analysis-report').getByRole('button',{name:text('下一步','Next'),exact:true}).click();await ready('replay');
 await step('replay').getByRole('button',{name:text('下一步','Next'),exact:true}).click();await step('done').waitFor();await page.keyboard.press('Escape');
 const key=`ddphysics-tour:v4:${encodeURIComponent(auth.user.id)}`;assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).status,key),'completed');
 await page.goto(base+'/#home');await target('profile-settings').waitFor();await page.waitForTimeout(800);assert.equal(await page.locator('.qdna-recommendations').count(),0);assert.equal(await page.locator('[data-tour-overlay]').count(),0);
 // Top entry replays one full guide, with no extra page menus or settings entry.
 await target('tour-help').click();await step('menu').waitFor();assert.equal(await page.locator('[data-tour="profile-tour-help"]').count(),0);
 await step('menu').getByRole('button',{name:text('重新开始完整教程','Restart full tour'),exact:true}).click();await ready('open');
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.documentElement.dataset.tourActive),undefined);
 assert.equal(writes.length,mobile?1:2);assert.ok(writes.every(w=>w.marked===true&&w.key==='ex-101-1'));assert.deepEqual(errors,[]);
 assert.equal(await page.locator('[data-tour-overlay]').count(),0);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 results.push({language,mobile,fullFlow:true,realSave:true,failedSaveTest:!mobile,refreshResume:true,bidirectionalLinks:true,topEntryReplay:true,analysisAndHomeRecommendation:true,errors});await context.close();
}
fs.writeFileSync(out+'/v3-result.json',JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,results}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));api.close();fs.rmSync(directory,{recursive:true});}
