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

const out=path.resolve('../output/ask-label-20261012');fs.mkdirSync(out,{recursive:true});
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
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});context.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));
 const email='ask-label@local.test';const otp=await(await context.request.post(base+'api/auth/code',{data:{email}})).json();const auth=await(await context.request.post(base+'api/auth/verify',{data:{email,code:otp.developmentCode}})).json();assert.ok((await context.request.put(base+'api/profile',{data:{nickname:'提问页面检查',grade:'中五',target:'5',password:'Ask-label-123',confirmPassword:'Ask-label-123'}})).ok());
 await context.addInitScript(id=>{try{localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped'}));}catch{}},auth.user.id);
 const page=await context.newPage();
 for(const language of ['chn','eng'])for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto(base);await page.evaluate(l=>localStorage.setItem('dse-physics-language-v1',l),language);await page.goto(base+'#ask');await page.reload();await page.locator('[data-tour="teacher-form"]').waitFor();
  const form=page.locator('.tutoring-form');const button=form.getByRole('button',{name:language==='chn'?'问老师':'Ask a teacher',exact:true});assert.equal(await button.count(),1);assert.equal(await button.isDisabled(),true);assert.equal(await page.locator('.tutoring-view>h1').evaluate(el=>el.nextElementSibling?.tagName),'FORM');assert.doesNotMatch(await page.locator('.tutoring-view').innerText(),/可以问真题|Replies appear below|发送问题|Send question/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await page.screenshot({path:path.join(out,language+'-'+width+'.png'),fullPage:true});report.views.push({language,width,passed:true});
 }
 await page.locator('[data-tour="teacher-message"]').fill('Isolated local label check');await page.locator('.tutoring-form').getByRole('button',{name:'Ask a teacher',exact:true}).click();await page.locator('.tutoring-thread').waitFor();assert.equal(await page.locator('.tutoring-thread').count(),1);assert.equal(await page.locator('[data-tour="teacher-message"]').inputValue(),'');report.flows.push({submit:'passed'});await context.close();assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));db.close();await browser.close();await new Promise(r=>server.close(r));api.close();fs.rmSync(directory,{recursive:true});}
console.log(JSON.stringify({views:report.views.length,flows:report.flows.length,passed:report.passed}));
