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

const out=path.resolve('../output/admin-free-20261012');fs.mkdirSync(out,{recursive:true});
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

const dataSnapshot=()=>Object.fromEntries(['memberships','membership_audit','payment_orders','payment_notifications','mistakes','mastered','question_status_events'].map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));
try{
 const students=[];
 for(const state of ['none','active','expired','revoked']){
  const context=await browser.newContext();const email='admin-'+state+'@local.test';const code=await(await context.request.post(base+'api/auth/code',{data:{email}})).json();const auth=await(await context.request.post(base+'api/auth/verify',{data:{email,code:code.developmentCode}})).json();const id=auth.user.id;students.push({id,state});
  assert.ok((await context.request.put(base+'api/profile',{data:{nickname:state+'学生',grade:'中五',target:'5',password:'Admin-free-123',confirmPassword:'Admin-free-123',region:'hong-kong'}})).ok());
  if(state!=='none')db.prepare('INSERT INTO memberships VALUES(?,?,?,?)').run(id,now+(state==='expired'?-1:86400000),state==='revoked'?1:0,3);
  assert.ok((await context.request.put(base+'api/mistakes',{data:{key:'ex-201-1',marked:true}})).ok());await context.close();
 }
 const id=students[1].id;
 db.prepare("INSERT INTO payment_orders(id,user_id,request_id,amount_fen,days,status,created_at) VALUES('historical-order',?,'historical-order',5900,30,'pending',?)").run(id,now-86400000);
 for(const target of ['membership','payment']){
  db.prepare('INSERT INTO page_visits VALUES(?,?,?,?,?,?)').run(id,'historical-'+target,target,now-7200000,now-7100000,70000);
  db.prepare('INSERT INTO learning_activity(user_id,event_id,action,target,at) VALUES(?,?,?,?,?)').run(id,'historical-'+target,'page_view',target,now-1000);
 }
 const before=dataSnapshot();
 const context=await browser.newContext({acceptDownloads:true,reducedMotion:'reduce'});const failures=[];
 context.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));context.on('response',r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status()});});
 context.on('request',r=>{if(/\/api\/admin\/(membership|orders)/.test(r.url()))report.forbiddenRequests.push(r.url());});
 assert.ok((await context.request.post(base+'api/admin/login',{data:{key:'isolated-free-browser'}})).ok());const page=await context.newPage();
 const check=async()=>{assert.doesNotMatch(await page.locator('body').innerText(),/会员|付款|Membership|payment/i);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.equal(await page.locator('.management-shell aside nav button').count(),6);};
 for(const language of ['chn','eng'])for(const width of [1440,1024,390]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'admin.html');await page.evaluate(l=>localStorage.setItem('dse-physics-language-v1',l),language);await page.reload();await page.locator('.metrics').waitFor();
  assert.equal(await page.locator('.metrics>div').count(),6);
  for(const tab of ['overview','users','questions','visits','tutoring','activity']){
   await page.goto(base+'admin.html#'+tab);await page.locator('aside nav [aria-current="page"]').waitFor();await page.waitForFunction(()=>!document.querySelector('main')?.textContent.includes('正在读取资料…'));await check();report.views.push({language,width,tab,passed:true});
   if(['overview','users','visits','activity'].includes(tab)&&width!==1024)await page.screenshot({path:path.join(out,language+'-'+width+'-'+tab+'.png'),fullPage:true});
   if(tab==='visits'||tab==='activity'){await page.locator('tbody tr').first().waitFor();assert.match(await page.locator('tbody').innerText(),language==='chn'?/已停用页面/:/Retired page/);assert.equal(await page.locator('a[href*="#membership"],a[href*="#payment"]').count(),0);}
  }
  for(const student of students){await page.goto(base+'admin.html#users?student='+student.id);await page.locator('.admin-learning').waitFor();await check();assert.doesNotMatch((await page.locator('.detail button,.detail label,.detail th,.detail summary').allTextContents()).join(' '),/到期|Expiry|extend|revoke/i);report.flows.push({language,width,student:student.state,feature:'detail'});}
  for(const hash of ['#membership','#members','#payments','#audit?filter=expired','#users?filter=active']){await page.goto(base+'admin.html'+hash);await page.waitForFunction(()=>!location.hash.includes('filter=')&&!/^#(membership|members|payments|audit)/.test(location.hash));await check();report.flows.push({language,width,feature:'retired-route',hash});}
 }
 await page.goto(base+'admin.html#users');await page.locator('tbody tr').first().waitFor();const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Excel/}).first().click()]);assert.equal(await download.failure(),null);const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(await download.path());assert.equal(workbook.getWorksheet('学生学习').rowCount,5);for(const sheet of workbook.worksheets)assert.doesNotMatch(sheet.getRow(1).values.join(' '),/会员|到期|membership|expiry/i);report.flows.push({feature:'excel-download',students:4});
 await context.close();assert.deepEqual(dataSnapshot(),before);assert.deepEqual(report.errors,[]);assert.deepEqual(failures,[]);assert.deepEqual(report.forbiddenRequests,[]);report.dataPreserved=true;report.passed=true;
}catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));db.close();await browser.close();await new Promise(r=>server.close(r));api.close();fs.rmSync(directory,{recursive:true});}
console.log(JSON.stringify({views:report.views.length,flows:report.flows.length,errors:report.errors.length,dataPreserved:report.dataPreserved,passed:report.passed}));
