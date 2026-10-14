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

const out=path.resolve('../output/student-export-merge-20261012');fs.mkdirSync(out,{recursive:true});
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

try{
 const profiles=[];
 for(let index=0;index<2;index++){
  const context=await browser.newContext();const email='merged-export-'+index+'@local.test';const otp=await(await context.request.post(base+'api/auth/code',{data:{email}})).json();const auth=await(await context.request.post(base+'api/auth/verify',{data:{email,code:otp.developmentCode}})).json();
  assert.ok((await context.request.put(base+'api/profile',{data:{nickname:'同名导出学生',grade:'中五',target:'5',region:index?'beijing':'hong-kong',avatar:'curie-read',password:'Merged-export-123',confirmPassword:'Merged-export-123'}})).ok());
  if(!index){assert.ok((await context.request.put(base+'api/progress',{data:{keys:['ex-101-1','tb-E201-1'],status:'mistake'}})).ok());assert.ok((await context.request.put(base+'api/progress',{data:{keys:['2012|paper-1a|1'],status:'mastered'}})).ok());}
  profiles.push({id:auth.user.id,email});await context.close();
 }
 const before=Object.fromEntries(['users','mistakes','mastered','events','memberships','payment_orders'].map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));
 const admin=await browser.newContext({acceptDownloads:true,reducedMotion:'reduce',viewport:{width:1440,height:1000}});admin.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));assert.ok((await admin.request.post(base+'api/admin/login',{data:{key:'isolated-free-browser'}})).ok());
 const page=await admin.newPage();await page.goto(base+'admin.html#users');await page.locator('tbody tr').first().waitFor();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Excel/}).first().click()]);assert.equal(await download.failure(),null);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(await download.path());assert.equal(workbook.worksheets.length,7);assert.equal(workbook.getWorksheet('學生摘要'),undefined);assert.equal(workbook.getWorksheet('学生摘要'),undefined);
 const sheet=workbook.getWorksheet('学生学习');assert.equal(sheet.rowCount,3);const labels=sheet.getRow(1).values.slice(1);assert.equal(new Set(labels).size,labels.length);const records=[2,3].map(n=>Object.fromEntries(labels.map((h,i)=>[h,sheet.getRow(n).getCell(i+1).value])));
 for(const profile of profiles){const row=records.find(r=>r['学生ID']===profile.id),user=db.prepare('SELECT * FROM users WHERE id=?').get(profile.id);assert.ok(row);assert.equal(row['邮箱'],profile.email);assert.equal(row['昵称'],user.nickname);assert.equal(row['角色'],'student');assert.equal(row['头像'],'curie-read');assert.equal(row['注册时间'],new Date(user.created_at).toISOString());assert.equal(row['最近登录时间'],new Date(user.last_login).toISOString());assert.equal(row['当前错题'],db.prepare('SELECT COUNT(*) n FROM mistakes WHERE user_id=?').get(profile.id).n);assert.equal(row['当前已掌握'],db.prepare('SELECT COUNT(*) n FROM mastered WHERE user_id=?').get(profile.id).n);assert.equal(row['相关知识点数'],new Set(db.prepare('SELECT question_key FROM mistakes WHERE user_id=?').all(profile.id).flatMap(r=>questions.get(r.question_key).points)).size);}
 assert.equal(workbook.getWorksheet('目前錯題').rowCount,3);assert.equal(workbook.getWorksheet('已掌握明细').rowCount,2);assert.equal(sheet.views[0].state,'frozen');assert.ok(sheet.autoFilter);assert.deepEqual(report.errors,[]);
 const after=Object.fromEntries(Object.keys(before).map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));delete before.users;delete after.users;assert.deepEqual(after,before);report.flows.push({actualDownload:true,worksheets:workbook.worksheets.map(s=>s.name),mergedColumns:labels,students:records.length,dataPreserved:true});report.passed=true;await admin.close();
}catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));db.close();await browser.close();await new Promise(r=>server.close(r));api.close();fs.rmSync(directory,{recursive:true});}
console.log(JSON.stringify({flows:report.flows.length,passed:report.passed}));
