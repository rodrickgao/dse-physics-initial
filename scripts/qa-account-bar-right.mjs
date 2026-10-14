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

const out=path.resolve('../output/account-bar-right-20261012');fs.mkdirSync(out,{recursive:true});
const directory=fs.mkdtempSync(path.join(tmpdir(),'ddphysics-account-right-'));
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
async function checkBar(page,label) {
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>scrollY===0);
 const result=await page.locator('.account-bar').evaluate(bar=>{
  const style=getComputedStyle(bar),box=bar.getBoundingClientRect();
  const items=[...bar.children].filter(el=>getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().width>0&&getComputedStyle(el).position!=='fixed').map(el=>{const b=el.getBoundingClientRect();return {name:el.className,left:b.left,right:b.right,top:b.top,center:b.top+b.height/2,bottom:b.bottom};});
  return {justify:style.justifyContent,gap:parseFloat(style.columnGap),right:box.right-parseFloat(style.paddingRight),left:box.left+parseFloat(style.paddingLeft),items,margin:getComputedStyle(bar.querySelector('.membership-status')).marginRight,mobileText:getComputedStyle(bar.querySelector('.membership-status')).textAlign,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+2};
 });
 assert.equal(result.justify,'flex-end',label+' alignment');assert.equal(result.margin,'0px',label+' spacing');assert.equal(result.overflow,false,label+' overflow');
 const settings=result.items.find(r=>r.name.includes('account-settings'));assert.ok(Math.abs(settings.right-result.right)<2,label+' settings right edge');
 for(let i=1;i<result.items.length;i++){const prev=result.items[i-1],item=result.items[i];if(Math.abs(item.center-prev.center)<2)assert.ok(item.left-prev.right<=result.gap+2,label+' unexpected horizontal gap');}
 if(result.viewport<=600)assert.equal(result.mobileText,'right');
 for(const item of result.items)assert.ok(item.left>=result.left-2&&item.right<=result.right+2,label+' header item boundary');
 report.views.push({label,...result,passed:true});
}
try {
 for(const state of ((process.env.DSE_HEADER_DEBUG||process.env.DSE_HEADER_CAPTURE)?['active']:['active','none','expired','revoked'])) {
  const context=await browser.newContext({reducedMotion:'reduce'});contexts.push(context);context.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));
  const email='header-'+state+'@local.test';const code=await(await context.request.post(base+'api/auth/code',{data:{email}})).json();const auth=await(await context.request.post(base+'api/auth/verify',{data:{email,code:code.developmentCode}})).json();
  assert.ok((await context.request.put(base+'api/profile',{data:{nickname:state==='active'?'Member preview':'Student '+state,grade:'中五',target:'5',region:'hong-kong',avatar:'newton-wave',password:'Account-right-123',confirmPassword:'Account-right-123'}})).ok());
  if(state!=='none')db.prepare('INSERT INTO memberships VALUES(?,?,?,?)').run(auth.user.id,now+(state==='expired'?-1:10*86400000),state==='revoked'?1:0,3);
  await context.addInitScript(id=>{try{localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped'}));}catch{}},auth.user.id);
  const page=await context.newPage();globalThis.checkPage=page;
  for(const language of (process.env.DSE_HEADER_DEBUG?['eng']:['chn','eng']))for(const width of (process.env.DSE_HEADER_DEBUG?[320]:process.env.DSE_HEADER_CAPTURE?[2140,1024,390]:state==='active'?[2140,1440,1180,1024,768,720,390,320]:[1440,390,320])) {
   await page.setViewportSize({width,height:1000});await page.goto(base+'#mistakes');await page.evaluate(l=>localStorage.setItem('dse-physics-language-v1',l),language);await page.reload();await page.locator('.membership-status').waitFor();
   await checkBar(page,state+'/'+language+'/'+width+'/mistakes');
   await page.locator('.account-settings').click();await page.locator('.profile-embedded').waitFor();await page.evaluate(()=>window.scrollTo(0,0));await checkBar(page,state+'/'+language+'/'+width+'/profile');
   if(state==='active'&&[2140,1024,390].includes(width)){
    const clip=await page.locator('.account-bar').boundingBox();await page.screenshot({path:path.join(out,'header-'+language+'-'+width+'.png'),clip});await page.locator('.profile-camera').click();await page.locator('#avatar-picker').waitFor();await page.waitForFunction(()=>document.activeElement?.id==='avatar-picker');await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await checkBar(page,state+'/'+language+'/'+width+'/avatar-picker');
    await page.screenshot({path:path.join(out,'profile-'+language+'-'+width+'.png')});
   }
  }
  if(state==='active'){
   await page.setViewportSize({width:1440,height:1000});await page.locator('.tour-help').click();await page.locator('.tour-panel').waitFor();report.flows.push({feature:'user-guide-menu',passed:true});
  }
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
} catch(error){report.failure=error.stack;if(globalThis.checkPage){await checkPage.screenshot({path:path.join(out,'failure.png')});report.overflowNodes=await checkPage.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const b=el.getBoundingClientRect();return b.width&&b.right>innerWidth+2;}).map(el=>({tag:el.tagName,class:el.className,text:el.textContent?.slice(0,80),rect:{left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}})));}throw error;}
finally{fs.writeFileSync(path.join(out,process.env.DSE_HEADER_CAPTURE?'visual-report.json':'browser-report.json'),JSON.stringify(report,null,2));for(const context of contexts)await context.close();db.close();await browser.close();await new Promise(r=>server.close(r));api.close();}
console.log(JSON.stringify({views:report.views.length,flows:report.flows.length,errors:report.errors,passed:report.passed}));
