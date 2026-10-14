import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createApi } from '../server/api.mjs';
import { printDocumentHtml, preparePrintedAnswerSpaces } from '../src/lib/study-content.js';
import { exerciseMistakeEntries } from '../src/lib/textbook-exercises.js';
import { exampleEntries } from '../src/lib/textbook-examples.js';

const out = path.resolve('../output/mistake-print-20261012');
const pdfOut = path.resolve('../output/pdf/mistake-print-20261012');
fs.mkdirSync(out, { recursive:true }); fs.mkdirSync(pdfOut, { recursive:true });
const directory = fs.mkdtempSync(path.join(tmpdir(), 'ddphysics-print-layout-'));
const email = 'print-layout@local.test';
const api = createApi({directory, localTestEmail:email,adminKey:'print-layout-isolated-test'});
const dist = path.resolve('dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = createServer((req,res)=>api.handler(req,res,()=>{
  if(api.protectFiles(req,res))return;
  try {
    const file = path.resolve(dist, '.' + (new URL(req.url,'http://localhost').pathname === '/' ? '/index.html' : decodeURIComponent(new URL(req.url,'http://localhost').pathname)));
    if(!file.startsWith(dist+path.sep)||!fs.statSync(file).isFile())throw Error();
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
  } catch {res.writeHead(404);res.end();}
}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({channel:'chrome',headless:true});
const report = {pdfs:[], flows:[], errors:[]};
const read = file=>JSON.parse(fs.readFileSync(file,'utf8'));
const catalog={window:{}};
runInNewContext(fs.readFileSync('site-data.js','utf8'),catalog);
const pastEntries = (keys, language) => keys.map(key=>{
  const [year,paper,id]=key.split('|');
  const record=read(`text-papers/${year}-${language}.json`)[key];assert.ok(record,key);
  const paperIndex=['paper-1a','paper-1b','paper-2'].indexOf(paper);
  const edition=catalog.window.DSE_SITE_DATA.years.find(y=>Number(y.year)===Number(year)&&y.language===language);
  const question=edition.papers[paperIndex].questions.find(q=>String(q.id||Number(String(q.label).replace(/\D/g,'')))===id);assert.ok(question,key);
  return {key,year:{year:Number(year),id:edition.id},paperIndex,question};
});
const contentFor = (entry,language)=>entry.source ? read(`assets/textbook-${entry.source === 'examples' ? 'examples' : 'exercises'}/${language}/${entry.exerciseChapter}.json`)[entry.key] : read(`text-papers/${entry.year.year}-${language}.json`)[entry.key];
const assetsReady = async page=>{
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
};

try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const otp=await(await context.request.post(base+'api/auth/code',{data:{email}})).json();
  const auth=await(await context.request.post(base+'api/auth/verify',{data:{email,code:otp.developmentCode}})).json();assert.ok(auth.user);
  const password='Local-print-'+crypto.randomUUID();
  assert.ok((await context.request.put(base+'api/profile',{data:{nickname:'打印检查',grade:'中五',target:'5',password,confirmPassword:password}})).ok());
  const membership=(await(await context.request.get(base+'api/membership')).json()).membership;
  assert.ok((await context.request.post(base+'api/admin/login',{data:{key:'print-layout-isolated-test'}})).ok());
  assert.ok((await context.request.post(base+'api/admin/membership',{data:{userId:auth.user.id,action:'extend',days:30,reason:'Isolated print layout check',revision:membership.revision,requestId:crypto.randomUUID()}})).ok());
  assert.ok((await(await context.request.get(base+'api/membership')).json()).membership.active);
  await context.addInitScript(id=>{localStorage.setItem(`ddphysics-tour:v4:${encodeURIComponent(id)}`,JSON.stringify({version:4,status:'skipped'}));window.print=()=>{};},auth.user.id);

  for(const language of ['chn','eng']) {
    const records=Object.assign({},...Array.from({length:14},(_,i)=>read(`text-papers/${i+2012}-${language}.json`)));
    const longestChoice=Object.entries(records).filter(([key,r])=>key.includes('paper-1a')||r.kind==='multiple-choice').sort((a,b)=>b[1].question.length-a[1].question.length)[0][0];
    const longestStructured=Object.entries(records).filter(([key,r])=>!key.includes('paper-1a')&&r.kind!=='multiple-choice').sort((a,b)=>b[1].question.length-a[1].question.length)[0][0];
    const mcKeys=[...new Set([...Array.from({length:10},(_,i)=>`2012|paper-1a|${i+1}`),'2012|paper-2|1.8',longestChoice])];
    const mc=pastEntries(mcKeys,language);
    assert.ok(mc.every(e=>e.paperIndex===0||e.question.kind==='multiple-choice'));
    const exercises=exerciseMistakeEntries(read(`assets/textbook-exercises/index-${language}.json`),[],language);
    const mixed=[...mc.slice(0,5),exercises.find(e=>e.key==='tb-201-1'),...pastEntries(['2012|paper-1b|1',longestStructured],language),exercises.find(e=>e.key==='tb-201-12'),exampleEntries().find(e=>e.key==='ex-103-6')];
    for(const [group,entries] of [['choice',mc],['mixed',mixed]]) for(const mode of ['questions','detailed']) {
      const ordered=entries.map((e,i)=>({...e,mistakeOrder:i}));
      const contents=ordered.map(e=>contentFor(e,language));assert.ok(contents.every(Boolean));
      const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
      await page.goto(base);await page.setContent(printDocumentHtml(ordered,contents,{language,mode,baseUrl:base,date:new Date(2026,9,12)}));await assetsReady(page);
      await page.evaluate(`(${preparePrintedAnswerSpaces.toString()})(document)`);
      const metrics=await page.locator('.print-question').evaluateAll(nodes=>nodes.map(n=>({key:n.dataset.question,title:n.querySelector('h2').innerText,height:n.getBoundingClientRect().height,bodyHeight:n.querySelector('.print-question-body').getBoundingClientRect().height,long:n.classList.contains('long-question'),longBody:n.querySelector('.print-question-body').classList.contains('long-question-body'),choice:n.classList.contains('print-choice'),paddingLeft:parseFloat(getComputedStyle(n).paddingLeft),overflow:n.scrollWidth>n.clientWidth+1})));
      assert.ok(metrics.every(m=>!m.overflow),JSON.stringify(metrics.filter(m=>m.overflow)));
      assert.equal(await page.locator('.answer-line,.answer-blank').count(),0);
      if(mode==='questions')assert.ok(metrics.filter(m=>m.choice).every(m=>m.paddingLeft===0));
      else assert.equal(await page.locator('.working-space').count(),0);
      await page.evaluate(`(${preparePrintedAnswerSpaces.toString()})(document)`);
      const repeated=await page.locator('.print-question').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
      assert.ok(repeated.every((height,i)=>Math.abs(height-metrics[i].height)<2),JSON.stringify({message:'repeated preparation must not accumulate spacing',metrics,repeated}));
      // Positioned pale markers let PDF extraction verify the actual browser's
      // page breaks, without adding space or changing the production HTML.
      await page.locator('.print-question').evaluateAll(nodes=>nodes.forEach((n,i)=>{
        const marker=(text,position)=>{const el=document.createElement('span');el.textContent=text;el.style.cssText=`position:absolute;${position};font:1px/1 Arial;color:rgba(0,0,0,.01)`;return el;};
        const heading=n.querySelector('h2'),content=n.querySelector('.question-content');heading.style.position='relative';content.style.position='relative';heading.append(marker(`BSTART${i}MARK`,'top:0;left:0'));content.append(marker(`BEND${i}MARK`,'bottom:0;right:0'));
      }));
      const file=`${language}-${group}-${mode}`;
      await page.screenshot({path:path.join(out,file+'.png'),fullPage:true});
      // beforeprint uses these same measurements in the real print window.
      await page.pdf({path:path.join(pdfOut,file+'.pdf'),preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
      report.pdfs.push({language,group,mode,path:path.join(pdfOut,file+'.pdf'),metrics});await page.close();
    }

    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(base);await page.evaluate(language=>localStorage.setItem('dse-physics-language-v1',language),language);
    for(const width of [1440,1024,390]) for(const [route,selector] of [['papers?question=2012%7Cpaper-1a%7C1','.study-flow[aria-busy="false"]'],['exercises?question=tb-201-1','[data-exercise][aria-busy="false"]'],['examples?question=ex-101-1','[data-example]']]) {
      const key=route.includes('papers')?'2012|paper-1a|1':route.includes('exercises')?'tb-201-1':'ex-101-1';
      assert.ok((await context.request.put(base+'api/progress',{data:{keys:[key],status:'clear'}})).ok());
      await page.setViewportSize({width,height:900});await page.goto(base+'#'+route);await page.locator(selector).first().waitFor();
      const mastered=page.locator('[data-mark-kind="mastered"]').first(),mistake=page.locator('[data-mark-kind="mistake"]').first();
      await mastered.click();await page.waitForFunction(()=>document.querySelector('[data-mark-kind="mastered"]')?.getAttribute('aria-pressed')==='true');
      assert.equal(await page.locator('.study-feedback').count(),0);
      await mastered.click();await page.waitForFunction(()=>document.querySelector('[data-mark-kind="mastered"]')?.getAttribute('aria-pressed')==='false');
      assert.equal(await page.locator('.study-feedback').count(),0);
      await mistake.click();await page.waitForFunction(()=>document.querySelector('[data-mark-kind="mistake"]')?.getAttribute('aria-pressed')==='true');
      assert.equal(await page.locator('.study-feedback').count(),0);
      await mistake.click();await page.waitForFunction(()=>document.querySelector('[data-mark-kind="mistake"]')?.getAttribute('aria-pressed')==='false');
      assert.equal(await page.locator('.study-feedback').count(),0);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
      report.flows.push({language,width,source:route.split('?')[0],status:'passed'});
      if(width===1440)await page.screenshot({path:path.join(out,`${language}-${route.split('?')[0]}-marks.png`)});
    }
    // Exercise the real export popup using the isolated student's saved marks.
    for(const key of ['2012|paper-1a|1','2012|paper-1a|2','tb-201-1'])assert.ok((await context.request.put(base+'api/mistakes',{data:{key,marked:true}})).ok());
    await page.setViewportSize({width:1440,height:1000});await page.goto(base+'#mistakes');await page.reload();await page.locator('[data-mistake]').first().waitFor();
    for(const mode of ['questions','detailed']) {
      const popupReady=page.waitForEvent('popup');
      await page.locator('.export-controls').getByRole('button',{name:language==='eng'?(mode==='questions'?'Questions':'Solutions'):(mode==='questions'?'原题版':'详解版'),exact:true}).click();
      const popup=await popupReady;await popup.locator('.print-question').first().waitFor();await assetsReady(popup);
      assert.equal(await popup.locator('.answer-line,.answer-blank').count(),0);assert.equal(await popup.locator('.print-brand img').count(),2);
      report.flows.push({language,source:'actual-popup',mode,status:'passed'});await popup.close();
    }
    await page.close();
  }
  assert.deepEqual(report.errors,[]);
  fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({pdfs:report.pdfs.length,flows:report.flows.length,errors:report.errors}));
} catch (error) {
  report.failure=error.stack;throw error;
} finally {
  fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));
  await browser.close();await new Promise(r=>server.close(r));api.close();
  if(!path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep))throw Error('Unexpected temporary directory');
  fs.rmSync(directory,{recursive:true});
}
