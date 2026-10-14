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

const out=path.resolve('../output/free-site-20261012');fs.mkdirSync(out,{recursive:true});
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
 for(const language of ['chn','eng']){
  const context=await browser.newContext({viewport:{width:language==='chn'?1440:390,height:1000},reducedMotion:'reduce'});
  context.on('page',page=>page.on('pageerror',e=>report.errors.push(e.message)));
  const email=language+'-free-tour@local.test';const code=await(await context.request.post(base+'api/auth/code',{data:{email}})).json();const auth=await(await context.request.post(base+'api/auth/verify',{data:{email,code:code.developmentCode}})).json();
  assert.ok((await context.request.put(base+'api/profile',{data:{nickname:'免费教程',grade:'中五',target:'5',password:'Free-browser-123',confirmPassword:'Free-browser-123'}})).ok());
  await context.addInitScript(l=>{try{localStorage.setItem('dse-physics-language-v1',l);}catch{}},language);
  const page=await context.newPage();await page.goto(base);await page.locator('.tour-panel[data-tour-step="welcome"]').waitFor();await page.getByRole('button',{name:language==='chn'?'开始体验':'Start exploring',exact:true}).click();
  const actions=[['open','example-chapter-101'],['solution','example-solution'],['mastered','mark-mastered'],['mark','mark-mistake'],['mistake-review','tour-mistake-open'],['question-knowledge','question-knowledge'],['knowledge-question','knowledge-question-2']];
  for(const [step,target] of actions){await page.locator('.tour-panel[data-tour-step="'+step+'"]').waitFor();const button=page.locator('[data-tour="'+target+'"]').filter({visible:true}).first();await button.click();}
  for(const step of ['analysis-open','analysis-report','replay']){await page.locator('.tour-panel[data-tour-step="'+step+'"]').waitFor();await page.locator('.tour-panel footer button').last().click();}
  await page.locator('.tour-panel[data-tour-step="done"]').waitFor();await page.screenshot({path:path.join(out,'tour-'+language+'.png')});await page.locator('.tour-panel footer button').click();
  const saved=await page.evaluate(id=>JSON.parse(localStorage.getItem('ddphysics-tour:v4:'+encodeURIComponent(id))),auth.user.id);assert.equal(saved.status,'completed');assert.deepEqual(saved.skippedSteps,[]);assert.equal(saved.lastCompleted,9);assert.doesNotMatch(await page.locator('body').innerText(),/会员|Membership|必修一免费/);report.tours.push({language,steps:10,status:'passed'});await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'tour-report.json'),JSON.stringify(report,null,2));db.close();await browser.close();await new Promise(r=>server.close(r));api.close();fs.rmSync(directory,{recursive:true});}
console.log(JSON.stringify({tours:report.tours.length,errors:report.errors,passed:report.passed}));
