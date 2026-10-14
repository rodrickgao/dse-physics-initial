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

const out=path.resolve('../output/top5-knowledge-20261012');fs.mkdirSync(out,{recursive:true});
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

const keys=['ex-101-1','ex-102-1','ex-103-1','ex-104-1','ex-105-1','ex-201-1','ex-202-1','ex-203-1','ex-204-1','2012|paper-1a|1','2012|paper-2|1.3','tb-E201-1'].filter(key=>questions.has(key));
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});context.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));context.on('response',r=>{if(r.status()>=400)report.responses.push({url:r.url(),status:r.status()});});
 const email='top5-knowledge@local.test';const otp=await(await context.request.post(base+'api/auth/code',{data:{email}})).json();const auth=await(await context.request.post(base+'api/auth/verify',{data:{email,code:otp.developmentCode}})).json();assert.ok((await context.request.put(base+'api/profile',{data:{nickname:'知识点统计检查',grade:'中五',target:'5',password:'Top5-topic-123',confirmPassword:'Top5-topic-123'}})).ok());
 await context.addInitScript(id=>{try{localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped'}));}catch{}},auth.user.id);
 const mark=async(selected)=>{assert.ok((await context.request.put(base+'api/progress',{data:{keys,status:'clear'}})).ok());if(selected.length)assert.ok((await context.request.put(base+'api/progress',{data:{keys:selected,status:'mistake'}})).ok());};
 await mark(keys);const summary=await(await context.request.get(base+'api/content/mistake-summary')).json();assert.ok(summary.knowledgeDistribution.filter(r=>r.sequence>0).length>5);
 const five=summary.knowledgeDistribution.filter(r=>r.sequence>0).slice(0,5).map(r=>r.keys[0]);const single=five.slice(0,1);const page=await context.newPage();
 for(const [scenario,selected] of [['many',keys],['five',five],['one',single],['empty',[]]]){
  await mark(selected);const saved=await(await context.request.get(base+'api/mistakes')).json();
  for(const language of ['chn','eng'])for(const width of [1440,1024,390]){
   now+=61000;await page.setViewportSize({width,height:1000});await page.goto(base);await page.evaluate(l=>localStorage.setItem('dse-physics-language-v1',l),language);await page.goto(base+'#mistakes');await page.reload();
   if(!selected.length){await page.locator('[data-tour="mistake-empty"]').waitFor();assert.equal(await page.locator('.chapter-pie-chart').count(),0);report.views.push({scenario,language,width,passed:true});continue;}
   await page.locator('.chapter-pie-legend').waitFor();
   const data=await(await context.request.get(base+'api/content/mistake-summary?language='+language)).json();const topics=data.knowledgeDistribution.filter(r=>r.sequence>0).slice(0,5);const expected=topics.map(r=>({id:String(r.sequence),name:r.name,count:r.keys.length}));const other=selected.length-topics.reduce((n,r)=>n+r.keys.length,0);if(other)expected.push({id:'other',name:language==='eng'?'Other':'其他',count:other});
   const rows=await page.locator('.chapter-pie-legend li').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.topic,name:n.querySelector('span').textContent,count:Number(n.querySelector('strong').textContent)})));assert.deepEqual(rows,expected);assert.equal(rows.reduce((n,r)=>n+r.count,0),selected.length);assert.equal(new Set(await page.locator('.chapter-pie-legend i').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor))).size,rows.length);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.match(await page.locator('.mistake-distribution h3').innerText(),language==='chn'?/知识点/:/Knowledge/);
   if(scenario==='many'&&width!==1024)await page.locator('.mistake-distribution').screenshot({path:path.join(out,language+'-'+width+'-top5.png')});
   await page.locator('.chapter-statistics-link').click();await page.locator('.mistake-statistics[open]').waitFor();assert.equal(await page.locator('.mistake-statistics tbody tr').count(),data.knowledgeDistribution.length);assert.equal(Number(await page.locator('.mistake-statistics tfoot td').first().innerText()),selected.length);assert.match(await page.locator('#mistake-statistics-title').innerText(),language==='chn'?/知识点/:/knowledge/i);
   const first=data.knowledgeDistribution[0];await page.locator('.mistake-statistics tbody tr button').first().click();await page.waitForFunction(()=>!document.querySelector('.mistake-statistics')?.open);await page.locator('.mistake-review-filter').waitFor();assert.deepEqual((await page.locator('[data-mistake]').evaluateAll(nodes=>nodes.map(n=>n.dataset.mistake))).sort(),[...first.keys].sort());await page.locator('.mistake-review-filter button').click();await page.locator('.chapter-pie-legend').waitFor();report.flows.push({scenario,language,width,detailAndFilter:true});report.views.push({scenario,language,width,rows,passed:true});
  }
  assert.deepEqual(await(await context.request.get(base+'api/mistakes')).json(),saved);
 }
 await context.close();assert.deepEqual(report.errors,[]);assert.deepEqual(report.responses,[]);report.passed=true;
}catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));db.close();await browser.close();await new Promise(r=>server.close(r));api.close();fs.rmSync(directory,{recursive:true});}
console.log(JSON.stringify({views:report.views.length,flows:report.flows.length,errors:report.errors.length,passed:report.passed}));
