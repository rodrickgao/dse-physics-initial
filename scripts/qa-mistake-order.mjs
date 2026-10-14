import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createApi } from '../server/api.mjs';
import { questions } from '../server/catalog.mjs';

const out=path.resolve('../output/mistake-order-20261012');
const pdfOut=path.resolve('../output/pdf/mistake-order-20261012');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(pdfOut,{recursive:true});
const directory=fs.mkdtempSync(path.join(tmpdir(),'ddphysics-mistake-order-'));
let now=Date.now();
const api=createApi({directory,adminKey:'isolated-mistake-order',clock:()=>now});
const dist=path.resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer((req,res)=>api.handler(req,res,()=>{
 if(api.protectFiles(req,res))return;
 try {
  const url=new URL(req.url,'http://localhost');const file=path.resolve(dist,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(dist+path.sep)||!fs.statSync(file).isFile())throw Error();
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 }catch {res.writeHead(404);res.end();}
}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={views:[],flows:[],pdfs:[],errors:[]};
const choose=(source,chapter,kind)=>[...questions.values()].find(q=>(q.source||'past-paper')===source&&(q.exerciseChapter||q.primaryChapterCode)===chapter&&q.kind===kind)?.key;
const expected=[choose('examples','101','structured'),choose('examples','E301','structured'),choose('textbook','201','multiple-choice'),choose('textbook','E201','multiple-choice'),choose('textbook','E301','multiple-choice'),choose('textbook','101','structured'),choose('past-paper','103','multiple-choice'),choose('past-paper','E101','multiple-choice'),choose('past-paper','101','structured')];
assert.ok(expected.every(Boolean));
const assetsReady=page=>page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 context.on('response',response=>{if(response.status()>=400)(report.failedResponses ||= []).push({url:response.url(),status:response.status()});});
 const otp=await(await context.request.post(base+'api/auth/code',{data:{email:'order-browser@local.test'}})).json();
 const auth=await(await context.request.post(base+'api/auth/verify',{data:{email:'order-browser@local.test',code:otp.developmentCode}})).json();assert.ok(auth.user);
 assert.ok((await context.request.put(base+'api/profile',{data:{nickname:'排序检查',grade:'中五',target:'5',password:'Isolated-order-123',confirmPassword:'Isolated-order-123'}})).ok());
 await context.addInitScript(id=>{localStorage.setItem(`ddphysics-tour:v4:${encodeURIComponent(id)}`,JSON.stringify({version:4,status:'skipped'}));window.print=()=>{};},auth.user.id);
 for(const key of [...expected].reverse())assert.ok((await context.request.put(base+'api/mistakes',{data:{key,marked:true}})).ok());
 const before=await(await context.request.get(base+'api/mistakes')).json();
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 for(const member of [false,true]) {
  if(member) {
   const admin=await browser.newContext();assert.ok((await admin.request.post(base+'api/admin/login',{data:{key:'isolated-mistake-order'}})).ok());
   assert.ok((await admin.request.post(base+'api/admin/membership',{data:{userId:auth.user.id,action:'extend',days:30,reason:'Isolated ordering check',revision:0,requestId:crypto.randomUUID()}})).ok());await admin.close();
  }
  for(const language of ['chn','eng']) for(const width of [1440,1024,390]) {
   // Advance only the isolated test clock between batches, retaining real limits.
   now+=61000;
   await page.setViewportSize({width,height:1000});await page.goto(base);
   await page.evaluate(language=>localStorage.setItem('dse-physics-language-v1',language),language);
   await page.goto(base+'#mistakes');await page.reload();await page.locator('[data-mistake]').first().waitFor();
   assert.deepEqual(await page.locator('[data-mistake]').evaluateAll(nodes=>nodes.map(n=>n.dataset.mistake)),expected);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   report.views.push({member,language,width,order:expected,status:'passed'});
   if(width===1440)await page.screenshot({path:path.join(out,`${language}-${member?'member':'free'}-list.png`),fullPage:true});
   // The real application loads protected question details before constructing the popup.
   if(width===1024)continue;
   for(const mode of ['questions','detailed']) {
    const ready=page.waitForEvent('popup');
    await page.locator('.export-controls').getByRole('button',{name:language==='eng'?(mode==='questions'?'Questions':'Solutions'):(mode==='questions'?'原题版':'详解版'),exact:true}).click();
    const popup=await ready;popup.on('pageerror',e=>report.errors.push(e.message));
    if(!member&&mode==='detailed') {
     await page.locator('.export-error').waitFor();
     assert.match((await page.locator('.export-error').innerText()),/会员|member/i);
     assert.ok(popup.isClosed());report.flows.push({member,language,width,mode,locked:true,status:'passed'});continue;
    }
    try {await popup.locator('.print-question').last().waitFor();await assetsReady(popup);}catch(error){throw Error(`${error.message}; export error: ${await page.locator('.export-error').allTextContents()}; failed responses: ${JSON.stringify(report.failedResponses)}`);}
    await page.locator('.export-controls button').first().waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('.export-controls button')?.disabled);
    assert.deepEqual(await popup.locator('.print-question').evaluateAll(nodes=>nodes.map(n=>n.dataset.question)),expected);
    const metrics=await popup.locator('.print-question').evaluateAll(nodes=>nodes.map(n=>({key:n.dataset.question,title:n.querySelector('h2').innerText,height:n.getBoundingClientRect().height,bodyHeight:n.querySelector('.print-question-body').getBoundingClientRect().height,long:n.classList.contains('long-question'),longBody:n.querySelector('.print-question-body').classList.contains('long-question-body'),choice:n.classList.contains('print-choice'),paddingLeft:parseFloat(getComputedStyle(n).paddingLeft),overflow:n.scrollWidth>n.clientWidth+1})));
    assert.equal(metrics.filter(m=>m.choice).length,5);assert.ok(metrics.every(m=>!m.overflow));
    assert.equal(await popup.locator('.print-choice .working-space,.answer-line,.answer-blank').count(),0);
    if(mode==='questions')assert.ok(metrics.filter(m=>m.choice).every(m=>m.paddingLeft===0));
    else assert.equal(await popup.locator('.working-space').count(),0);
    assert.equal(await page.locator('.study-feedback').count(),0);
    report.flows.push({member,language,width,mode,status:'passed'});
    if(member&&width===1440) {
     await popup.locator('.print-question').evaluateAll(nodes=>nodes.forEach((n,i)=>{
      const marker=(text,position)=>{const el=document.createElement('span');el.textContent=text;el.style.cssText=`position:absolute;${position};font:1px/1 Arial;color:rgba(0,0,0,.01)`;return el;};
      const heading=n.querySelector('h2'),content=n.querySelector('.question-content');heading.style.position='relative';content.style.position='relative';heading.append(marker(`BSTART${i}MARK`,'top:0;left:0'));content.append(marker(`BEND${i}MARK`,'bottom:0;right:0'));
     }));
     const file=path.join(pdfOut,`${language}-mixed-${mode}.pdf`);
     await popup.pdf({path:file,preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
     report.pdfs.push({language,group:'mixed',mode,path:file,metrics});
    }
    await popup.close();
   }
  }
 }
 assert.deepEqual(await(await context.request.get(base+'api/mistakes')).json(),before);
 assert.deepEqual(report.errors,[]);await context.close();
 console.log(JSON.stringify({views:report.views.length,popups:report.flows.length,pdfs:report.pdfs.length,errors:report.errors}));
}catch(error){report.failure=error.stack;throw error;}
finally {
 fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));
 await browser.close();await new Promise(r=>server.close(r));api.close();
 if(!path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep))throw Error('Unexpected temporary directory');
 fs.rmSync(directory,{recursive:true});
}
