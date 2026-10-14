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

const out=path.resolve('../output/admin-membership-layout-20261012');fs.mkdirSync(out,{recursive:true});
const directory=fs.mkdtempSync(path.join(tmpdir(),'ddphysics-membership-layout-'));
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


const contexts=[];
try {
 for(const state of ['none','active','expired','revoked']) {
  const context=await browser.newContext();contexts.push(context);
  const email='layout-'+state+'@local.test';
  const code=await(await context.request.post(base+'api/auth/code',{data:{email}})).json();
  const auth=await(await context.request.post(base+'api/auth/verify',{data:{email,code:code.developmentCode}})).json();
  assert.ok((await context.request.put(base+'api/profile',{data:{nickname:'布局 '+state,grade:'中五',target:'5',region:'hong-kong',password:'Layout-member-123',confirmPassword:'Layout-member-123'}})).ok());
  if(state!=='none')db.prepare('INSERT INTO memberships VALUES(?,?,?,?)').run(auth.user.id,now+(state==='expired'?-1:3*86400000),state==='revoked'?1:0,3);
  assert.ok((await context.request.put(base+'api/mistakes',{data:{key:'2012|paper-1a|1',marked:true}})).ok());
 }
 const admin=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000}});contexts.push(admin);
 admin.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));
 assert.ok((await admin.request.post(base+'api/admin/login',{data:{key:'isolated-free-browser'}})).ok());
 const overview=await(await admin.request.get(base+'api/admin/overview')).json();
 assert.equal(overview.summary.students,4);assert.equal(overview.summary.members,1);assert.equal(overview.summary.expiring,1);
 const page=await admin.newPage();
 for(const language of ['chn','eng'])for(const width of [1440,1024,390]) {
  await page.setViewportSize({width,height:1000});await page.goto(base+'admin.html#overview');
  await page.evaluate(l=>localStorage.setItem('dse-physics-language-v1',l),language);await page.reload();
  await page.locator('.admin-overview-membership').waitFor();
  await page.getByRole('heading',{name:language==='eng'?'Membership overview':'会员概况',exact:true}).waitFor();
  const general=page.locator('.admin-overview-students .metrics'),member=page.locator('.admin-overview-membership .metrics');
  assert.deepEqual(await general.locator('strong').allTextContents(),[overview.summary.students,overview.summary.newStudents,overview.summary.active,overview.summary.operations,overview.summary.mistakes,overview.summary.focusMinutes].map(String));
  assert.deepEqual(await member.locator('strong').allTextContents(),[overview.summary.members,overview.summary.expiring].map(String));
  assert.equal(await general.locator(':scope>div').count(),6);assert.equal(await member.locator(':scope>div').count(),2);
  assert.equal(await page.locator('.admin-overview-membership .admin-membership-chart').count(),1);
  assert.equal(await page.locator('.admin-charts .admin-membership-chart').count(),0);
  assert.deepEqual(await page.locator('.admin-membership-chart .admin-bar strong').allTextContents(),['1','1','1','1']);
  assert.equal(await page.locator('.admin-overview-students .admin-shortcuts button').count(),2);
  assert.equal(await page.locator('.admin-overview-membership .admin-shortcuts button').count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'viewport overflow');
  const generalBox=await page.locator('.admin-overview-students').boundingBox(),memberBox=await page.locator('.admin-overview-membership').boundingBox();
  assert.ok(memberBox.y>=generalBox.y+generalBox.height,'separate non-overlapping regions');
  const distribution=page.locator('.admin-membership-chart');const chartBox=await distribution.boundingBox(),metricsBox=await member.boundingBox();
  if(width===1440)assert.ok(chartBox.x>=metricsBox.x+metricsBox.width,'side-by-side membership region');
  else assert.ok(chartBox.y>=metricsBox.y+metricsBox.height,'stacked membership region');
  report.views.push({language,width,generalMetrics:6,membershipMetrics:2,distribution:[1,1,1,1],passed:true});
  if(width===1440||width===390)await page.screenshot({path:path.join(out,'overview-'+language+'-'+width+'.png'),fullPage:true});
  await page.locator('.admin-overview-membership').getByRole('button',{name:language==='eng'?'Payment requests →':'付款申请 →',exact:true}).click();
  await page.locator('header h1').filter({hasText:language==='eng'?'Payment requests':'付款申请'}).waitFor();assert.equal(new URL(page.url()).hash,'#payments');
  await page.goto(base+'admin.html#overview');await page.locator('.admin-overview-students').getByRole('button',{name:language==='eng'?'Student learning →':'学生学习 →',exact:true}).click();
  await page.locator('main select').first().waitFor();assert.equal(new URL(page.url()).hash,'#users');
  await page.goto(base+'admin.html#overview');await page.locator('.admin-overview-students').getByRole('button',{name:language==='eng'?'Teacher Q&A →':'答疑 →',exact:true}).click();
  await page.locator('header h1').filter({hasText:language==='eng'?'Teacher Q&A':'答疑'}).waitFor();assert.equal(new URL(page.url()).hash,'#tutoring');
  report.flows.push({language,width,links:['payments','users','tutoring'],passed:true});
 }
 const book=new ExcelJS.Workbook();const exportResult=await(await admin.request.get(base+'api/admin/export')).json();await book.xlsx.load(Buffer.from(exportResult.base64,'base64'));
 assert.equal(book.worksheets.length,7);assert.equal(book.getWorksheet('学生学习').columnCount,19);
 assert.deepEqual(report.errors,[]);report.passed=true;
} catch(error) {report.failure=error.stack;throw error;}
finally {
 fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));
 for(const context of contexts)await context.close();
 db.close();await browser.close();await new Promise(r=>server.close(r));api.close();
}
console.log(JSON.stringify({views:report.views.length,flows:report.flows.length,errors:report.errors,passed:report.passed}));
