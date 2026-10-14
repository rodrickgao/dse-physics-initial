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

const out=path.resolve('../output/restore-membership-20261012');fs.mkdirSync(out,{recursive:true});
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

const savedKeys=['ex-101-1','ex-E301-1','tb-201-1','tb-E201-1','tb-E301-1','tb-101-7','2012|paper-1a|1','2012|paper-2|1.3','2015|paper-1b|1'];
const users=new Map();
const adminOnly=process.env.DSE_RESTORE_ADMIN_ONLY==='1';
const check=async(page,label)=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),label+' overflow');
const screenshot=async(page,name)=>page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
try{
 for(const state of ['none','active','expired','revoked']){
  const context=await browser.newContext({reducedMotion:'reduce',acceptDownloads:true});context.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));
  const email='restore-'+state+'@local.test';const code=await(await context.request.post(base+'api/auth/code',{data:{email}})).json();const auth=await(await context.request.post(base+'api/auth/verify',{data:{email,code:code.developmentCode}})).json();assert.ok((await context.request.put(base+'api/profile',{data:{nickname:'恢复会员 '+state,grade:'中五',target:'5',region:'hong-kong',password:'Restore-member-123',confirmPassword:'Restore-member-123'}})).ok());
  if(state!=='none')db.prepare('INSERT INTO memberships VALUES(?,?,?,?)').run(auth.user.id,now+(state==='expired'?-1:86400000),state==='revoked'?1:0,3);
  for(const key of savedKeys)assert.ok((await context.request.put(base+'api/mistakes',{data:{key,marked:true}})).ok());
  await context.addInitScript(id=>{try{localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped'}));}catch{}window.print=()=>{};},auth.user.id);
  const page=await context.newPage();users.set(state,{context,page,id:auth.user.id});
  if(adminOnly){await page.goto(base+'#mistakes');await page.locator('.membership-status').waitFor();continue;}
  const original=await(await context.request.get(base+'api/mistakes')).json();
  for(const language of ['chn','eng'])for(const width of [1440,1024,390]){
   now+=61000;await page.setViewportSize({width,height:1000});await page.goto(base);await page.evaluate(l=>localStorage.setItem('dse-physics-language-v1',l),language);await page.reload();await page.locator('.membership-status').waitFor();
   for(const hash of ['#membership','#papers?question=2025%7Cpaper-1a%7C1','#exercises?question=tb-E201-1','#textbook?knowledge=48','#mistakes','#ask']){
    await page.goto(base+hash);
    if(hash==='#membership'){await page.locator('.subscription-view').waitFor();}
    if(hash.startsWith('#papers')){const solution=page.locator('[data-tour="paper-solution"]');await solution.waitFor();if(await solution.getAttribute('aria-expanded')!=='true')await solution.click();const detail=page.locator('[aria-controls="reasoning-stage"]');if(state==='active'){if(await detail.getAttribute('aria-expanded')!=='true')await detail.click();await page.locator('#reasoning-stage .study-content').waitFor();}else{assert.ok(await detail.isDisabled());assert.equal(await page.locator('#reasoning-stage').count(),0);await page.locator('.member-notice').first().waitFor();}}
    if(hash.startsWith('#exercises')){await page.locator('[data-tour="exercise-ready"]').waitFor();const solution=page.locator('.stage-toggle').first();if(await solution.getAttribute('aria-expanded')!=='true')await solution.click();const detail=page.locator('.stage-toggle').nth(1);if(state==='active'){if(await detail.getAttribute('aria-expanded')!=='true')await detail.click();await page.locator('.reasoning-content').waitFor();}else assert.ok(await detail.isDisabled());}
    if(hash.startsWith('#textbook')){await page.locator('[data-tour="knowledge-card"]').first().waitFor();if(state!=='active')await page.locator('.member-notice').first().waitFor();assert.equal(await page.locator('[data-tour="chapter-download"]').count(),0);}
    if(hash==='#mistakes'){
     await page.locator('[data-mistake]').first().waitFor();assert.equal(await page.locator('[data-mistake]').count(),9);assert.equal(await page.locator('.study-feedback').count(),0);
     if(state==='active')await page.locator('.chapter-pie-chart').waitFor();else assert.equal(await page.locator('.chapter-pie-chart').count(),0);
     const guidance=await(await context.request.get(base+'api/learning/dashboard?language='+language)).json();if(state!=='active'){assert.equal(guidance.recommendations.trialOnly,true);assert.ok(guidance.recommendations.new_questions.every(q=>q.trialAvailable));}else assert.equal(Boolean(guidance.recommendations.trialOnly),false);
     if(width!==1024)for(const mode of ['questions','detailed']){
      const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('.export-controls').getByRole('button',{name:language==='eng'?(mode==='questions'?'Questions':'Solutions'):(mode==='questions'?'原题版':'详解版'),exact:true}).click()]);
      if(state!=='active'&&mode==='detailed'){await page.locator('.export-error').waitFor();assert.match(await page.locator('.export-error').innerText(),/会员|member/i);assert.ok(popup.isClosed());report.flows.push({state,language,width,print:mode,locked:true});}
      else{await popup.locator('.print-question').last().waitFor();assert.equal(await popup.locator('.print-question').count(),9);assert.equal(await popup.locator('.print-choice .working-space,.answer-line').count(),0);await popup.close();report.flows.push({state,language,width,print:mode,locked:false});}
      await page.waitForFunction(()=>!document.querySelector('.export-controls button')?.disabled);
     }
    }
    if(hash==='#ask'){await page.locator('.tutoring-view').waitFor();if(state==='active'){await page.locator('.tutoring-form').waitFor();assert.equal(await page.locator('.tutoring-view>h1').evaluate(el=>el.nextElementSibling.tagName),'FORM');assert.equal(await page.locator('.tutoring-form').getByRole('button',{name:language==='chn'?'问老师':'Ask a teacher',exact:true}).count(),1);}else{assert.equal(await page.locator('.tutoring-form').count(),0);await page.locator('.tutoring-view a[href="#membership"]').waitFor();}}
    await check(page,state+'/'+language+'/'+width+'/'+hash);report.views.push({state,language,width,hash,passed:true});
    if(width===1440&&language==='chn'&&['#membership','#mistakes','#ask'].includes(hash))await screenshot(page,state+'-'+hash.slice(1));
   }
  }
  assert.deepEqual(await(await context.request.get(base+'api/mistakes')).json(),original);
 }
 const admin=await browser.newContext({acceptDownloads:true,reducedMotion:'reduce',viewport:{width:1440,height:1000}});admin.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));assert.ok((await admin.request.post(base+'api/admin/login',{data:{key:'isolated-free-browser'}})).ok());const page=await admin.newPage();
 await page.goto(base+'admin.html#users');await page.locator('tbody tr').first().waitFor();assert.match(await page.locator('thead').innerText(),/会员状态/);
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Excel/}).first().click()]);const book=new ExcelJS.Workbook();await book.xlsx.readFile(await download.path());assert.equal(book.getWorksheet('學生摘要'),undefined);assert.equal(book.worksheets.length,7);const sheet=book.getWorksheet('学生学习');assert.equal(sheet.rowCount,5);const labels=sheet.getRow(1).values.slice(1);assert.equal(labels.length,19);const records=[2,3,4,5].map(n=>Object.fromEntries(labels.map((h,i)=>[h,sheet.getRow(n).getCell(i+1).value])));const names={none:'未开通',active:'有效会员',expired:'已到期',revoked:'已暂停'};for(const [state,user] of users)assert.equal(records.find(r=>r['学生ID']===user.id)['会员状态'],names[state]);report.flows.push({feature:'merged-excel-membership',students:4,columns:19});
 for(const filter of ['active','expired','revoked','none']){await page.goto(base+'admin.html#users?filter='+filter);await page.waitForFunction(()=>document.querySelector('main select')?.value===location.hash.split('filter=')[1]);assert.equal(await page.locator('tbody tr').count(),1);report.flows.push({feature:'membership-filter',filter});}
 const change=async(state,action)=>{const user=users.get(state);await page.goto(base+'admin.html#users?student='+user.id);await page.locator('.admin-membership').waitFor();if(!await page.locator('.admin-membership').evaluate(el=>el.open))await page.locator('.admin-membership summary').click();await page.locator('.membership-form input').fill('隔离测试会员恢复');await page.locator('.membership-form').getByRole('button',{name:action==='extend'?'开通／延长会员':'暂停会员',exact:true}).click();await page.locator('.confirm-dialog').getByRole('button',{name:'确认保存',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.confirm-dialog'));await user.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await user.page.waitForFunction(active=>{const text=document.querySelector('.membership-status')?.textContent||'';return active?/会员至|Member until/i.test(text):/暂停|paused/i.test(text);},action==='extend');report.flows.push({feature:'admin-change',state,action});};
 await change('none','extend');await change('active','revoke');await screenshot(page,'admin-member-controls');
 const renewed=users.get('none');await renewed.page.goto(base+'#ask');await renewed.page.locator('.tutoring-form').waitFor();const paused=users.get('active');await paused.page.goto(base+'#ask');await paused.page.locator('.tutoring-view a[href="#membership"]').waitFor();report.flows.push({feature:'permissions-refresh',renewed:true,paused:true});
 const expired=users.get('expired');const order=await expired.context.request.post(base+'api/orders',{data:{requestId:crypto.randomUUID(),paymentMethod:'wechat'}});assert.ok(order.ok());const result=await order.json();assert.equal(result.order.status,'pending');assert.equal((await(await expired.context.request.get(base+'api/membership')).json()).membership.active,true);await page.goto(base+'admin.html#payments');await page.getByRole('button',{name:'确认通过',exact:true}).first().waitFor();await page.getByRole('button',{name:'确认通过',exact:true}).first().click();await page.waitForFunction(()=>document.querySelector('main')?.textContent.includes('已通过'));report.flows.push({feature:'payment-approval',method:'wechat'});await screenshot(page,'admin-payments');
 for(const user of users.values())await user.context.close();await admin.close();assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,adminOnly?'admin-report.json':'browser-report.json'),JSON.stringify(report,null,2));db.close();await browser.close();await new Promise(r=>server.close(r));api.close();fs.rmSync(directory,{recursive:true});}
console.log(JSON.stringify({views:report.views.length,flows:report.flows.length,errors:report.errors,passed:report.passed}));
