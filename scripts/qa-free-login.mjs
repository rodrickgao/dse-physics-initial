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
 const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 for(const language of ['chn','eng'])for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto(base);await page.evaluate(l=>localStorage.setItem('dse-physics-language-v1',l),language);await page.reload();await page.locator('.login-brand-highlights').waitFor();
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));});
  assert.ok(await page.locator('.auth-card').evaluate(node=>getComputedStyle(node).opacity==='1'));assert.ok(await page.locator('.login-brand-highlights').evaluate(node=>getComputedStyle(node).opacity==='1'));assert.match(await page.locator('body').innerText(),language==='eng'?/All features are free/:/全部功能免费/);await page.screenshot({path:path.join(out,'login-'+language+'-'+width+'.png'),fullPage:true});report.views.push({language,width,animation:'settled',passed:true});
 }
 await context.close();assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'login-visual-report.json'),JSON.stringify(report,null,2));db.close();await browser.close();await new Promise(r=>server.close(r));api.close();fs.rmSync(directory,{recursive:true});}
console.log(JSON.stringify({views:report.views.length,passed:report.passed}));
