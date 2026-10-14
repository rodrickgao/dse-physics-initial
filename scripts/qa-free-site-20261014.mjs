import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createApi} from '../server/api.mjs';
import {points,questions} from '../server/catalog.mjs';

const out=path.resolve('../output/free-site-20261014');fs.mkdirSync(out,{recursive:true});
const directory=fs.mkdtempSync(path.join(tmpdir(),'ddphysics-free-browser-'));
let now=Date.now();
const api=createApi({directory,adminKey:'isolated-free-browser',clock:()=>now,qdnaDirectory:path.resolve('../output/qdna-20261008')});
const dist=path.resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer((req,res)=>api.handler(req,res,()=>{
 if(api.protectFiles(req,res))return;
 try{const url=new URL(req.url,'http://localhost'),file=path.resolve(dist,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(dist+path.sep)||!fs.statSync(file).isFile())throw Error();res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end();}
}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({channel:'chrome',headless:true});const db=new DatabaseSync(path.join(directory,'students.sqlite'));
const report={views:[],flows:[],tours:[],errors:[],responses:[],forbiddenRequests:[]};
const entries=['ex-201-1','ex-E301-1','tb-201-1','tb-E201-1','tb-E301-1','tb-101-7','2012|paper-1a|1','2012|paper-2|1.3','2015|paper-1b|1'];
const watch=context=>{
 context.on('page',page=>page.on('pageerror',e=>report.errors.push(e.message)));
 context.on('request',r=>{if(/\/api\/(membership|orders)(?:\?|$)/.test(r.url()))report.forbiddenRequests.push(r.url());});
 context.on('response',r=>{if(r.status()>=400)report.responses.push({url:r.url(),status:r.status(),body:r.request().postData()});});
};
const check=async(page,label)=>{
 assert.equal(await page.locator('.member-notice,.membership-status,.qdna-membership-lock').count(),0,label);
 assert.doesNotMatch(await page.locator('body').innerText(),/会员|付费|扫码支付|Membership|Activate.*member|Compulsory 1.*free|必修一免费/i,label);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),label+' overflow');
};
async function goto(page,hash,ready){await page.goto(base+hash);await page.locator(ready).first().waitFor();}
try{
 const guest=await browser.newContext();watch(guest);const loginPage=await guest.newPage();
 for(const language of ['chn','eng'])for(const width of [1440,1024,390]){
  await loginPage.setViewportSize({width,height:1000});await loginPage.goto(base);await loginPage.evaluate(l=>localStorage.setItem('dse-physics-language-v1',l),language);await loginPage.evaluate(()=>{localStorage.removeItem('ddphysics-welcome-choice');localStorage.removeItem('dse-remembered-emails-v1');});await loginPage.reload();await loginPage.locator('.login-brand-highlights').waitFor();
  assert.match(await loginPage.locator('body').innerText(),language==='eng'?/All features are free/i:/全部功能免费/);await check(loginPage,'login');report.views.push({state:'guest',language,width,page:'login'});
  if(width!==1024)await loginPage.screenshot({path:path.join(out,`login-${language}-${width}.png`),fullPage:true});
 }
 await guest.close();
 for(const state of ['none','active','expired','revoked']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',acceptDownloads:true});watch(context);
  const email=`${state}-browser@local.test`;const code=await(await context.request.post(base+'api/auth/code',{data:{email}})).json();const auth=await(await context.request.post(base+'api/auth/verify',{data:{email,code:code.developmentCode}})).json();assert.ok(auth.user);
  assert.ok((await context.request.put(base+'api/profile',{data:{nickname:state+'免费检查',grade:'中五',target:'5',region:'hong-kong',password:'Free-browser-123',confirmPassword:'Free-browser-123'}})).ok());
  if(state!=='none')db.prepare('INSERT INTO memberships VALUES(?,?,?,?)').run(auth.user.id,now+(state==='expired'?-1:86400000),state==='revoked'?1:0,5);
  await context.addInitScript(id=>{try{localStorage.setItem(`ddphysics-tour:v4:${encodeURIComponent(id)}`,JSON.stringify({version:4,status:'skipped'}));}catch{}window.print=()=>{};},auth.user.id);
  for(const key of [...entries].reverse())assert.ok((await context.request.put(base+'api/mistakes',{data:{key,marked:true}})).ok());
  const original=(await context.request.get(base+'api/mistakes')).json();const history=db.prepare('SELECT * FROM memberships WHERE user_id=?').get(auth.user.id);
  const page=await context.newPage();
  for(const language of ['chn','eng'])for(const width of [1440,1024,390]){
   now+=61000;await page.setViewportSize({width,height:1000});await page.goto(base);await page.evaluate(l=>localStorage.setItem('dse-physics-language-v1',l),language);await page.reload();
   const views=[['#home','.home-view'],['#examples?question=ex-201-1','[data-tour="example-state"][data-ready="true"]'],['#exercises?question=tb-E201-1','[data-tour="exercise-ready"]'],['#papers?question=2025%7Cpaper-1a%7C1','[data-tour="paper-solution"]'],['#textbook?knowledge=48','[data-tour="chapter-download"]'],['#mistakes','[data-mistake]'],['#ask','[data-tour="teacher-form"]']];
   for(const [hash,ready] of views){
    await goto(page,hash,ready);
    if(hash.startsWith('#examples')){await page.locator('[data-tour="example-solution"]').click();assert.ok((await page.locator('.study-stage').count())>=2);assert.ok((await page.locator('[data-tour="question-knowledge"]').count())>0);}
    if(hash.startsWith('#exercises')){await page.locator('.stage-toggle').first().click();await page.locator('.stage-toggle').nth(1).click();assert.ok((await page.locator('.study-stage').count())>=3);}
    if(hash.startsWith('#papers')){await page.locator('[data-tour="paper-solution"]').click();await page.locator('[aria-controls="reasoning-stage"]').click();await page.locator('#reasoning-stage .study-content').first().waitFor();}
    if(hash.startsWith('#textbook')){await page.locator('.knowledge-card-list .knowledge-point-card').first().scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.knowledge-questions,.related-exercises'));assert.ok((await page.locator('[data-tour="chapter-download"]').getAttribute('href')).includes('/'+points.get(48).code+'.pdf'));if(width===1440){const downloadReady=page.waitForEvent('download');await page.locator('[data-tour="chapter-download"]').click();const download=await downloadReady;assert.equal(await download.failure(),null);report.flows.push({state,language,feature:'chapter-download'});}}
    if(hash==='#mistakes'){
     const order=await page.locator('[data-mistake]').evaluateAll(nodes=>nodes.map(n=>n.dataset.mistake));assert.equal(order.length,9);assert.equal(questions.get(order[7]).kind,'multiple-choice');
     if(width!==1024){for(const mode of ['questions','detailed']){const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('.export-controls').getByRole('button',{name:language==='eng'?(mode==='questions'?'Questions':'Solutions'):(mode==='questions'?'原题版':'详解版'),exact:true}).click()]);await popup.locator('.print-question').last().waitFor();assert.equal(await popup.locator('.print-question').count(),9);assert.equal(await popup.locator('.print-choice .working-space,.answer-line').count(),0);if(mode==='detailed')assert.equal(await popup.locator('.working-space').count(),0);report.flows.push({state,language,width,feature:'print-'+mode});await popup.close();await page.waitForFunction(()=>!document.querySelector('.export-controls button')?.disabled);}}
     await page.locator('#statistics-book').waitFor();
    }
    await check(page,`${state}/${language}/${width}/${hash}`);report.views.push({state,language,width,page:hash});
    if(state==='none'&&width!==1024&&['#mistakes','#textbook?knowledge=48','#ask'].includes(hash))await page.screenshot({path:path.join(out,`${language}-${width}-${hash.split('?')[0].slice(1)}.png`),fullPage:true});
   }
   for(const old of ['membership','payment','receipt','activating','member-success']){await goto(page,'#'+old,'.home-view');await check(page,'legacy '+old);}
  }
  assert.deepEqual(await(await context.request.get(base+'api/mistakes')).json(),await original);assert.deepEqual(db.prepare('SELECT * FROM memberships WHERE user_id=?').get(auth.user.id),history);
  await goto(page,'#ask','[data-tour="teacher-form"]');await page.locator('[data-tour="teacher-message"]').fill('Isolated local free access test');await page.locator('.tutoring-form button').last().click();await page.locator('.tutoring-thread').waitFor();report.flows.push({state,feature:'submit-question'});
  await context.close();
 }
 const admin=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});watch(admin);assert.ok((await admin.request.post(base+'api/admin/login',{data:{key:'isolated-free-browser'}})).ok());const page=await admin.newPage();
 for(const language of ['chn','eng']){
  await page.goto(base+'admin.html');await page.evaluate(l=>localStorage.setItem('dse-physics-language-v1',l),language);await page.reload();await page.locator('.metrics').waitFor();assert.equal(await page.locator('.metrics>div').count(),6);await check(page,'admin overview');await page.screenshot({path:path.join(out,`admin-${language}.png`),fullPage:true});
  await page.goto(base+'admin.html#users');await page.locator('tbody tr').first().waitFor();await check(page,'admin users');assert.doesNotMatch(await page.locator('thead').innerText(),/会员|Membership/);await page.locator('tbody tr button').first().click();await page.locator('.admin-learning').waitFor();await check(page,'admin detail');report.views.push({state:'admin',language,page:'users/detail'});
 }
 const exportData=await(await admin.request.get(base+'api/admin/export')).json();const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(exportData.base64,'base64'));const sheet=workbook.getWorksheet('学生学习');assert.equal(sheet.rowCount,5);assert.doesNotMatch(sheet.getRow(1).values.join(' '),/会员|Membership|到期/);report.flows.push({feature:'admin-export',students:4});await admin.close();
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.responses,[]);assert.deepEqual(report.forbiddenRequests,[]);report.passed=true;
}catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));db.close();await browser.close();await new Promise(r=>server.close(r));api.close();fs.rmSync(directory,{recursive:true});}
console.log(JSON.stringify({views:report.views.length,flows:report.flows.length,errors:report.errors.length,passed:report.passed}));
