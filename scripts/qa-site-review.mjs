import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {createApi} from '../server/api.mjs';
import {GRADES,TARGETS,AVATAR_IDS} from '../src/lib/avatar-catalog.js';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const directory=fs.mkdtempSync(join(tmpdir(),'ddphysics-tour-v2-')),out='../output/site-review-20261009';
const api=createApi({directory,localTestEmail:'audit-eng@local.test'});
const root=resolve('dist');const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer((req,res)=>api.handler(req,res,()=>{if(api.protectFiles(req,res))return;try{const pathname=new URL(req.url,'http://localhost').pathname;const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root)||!fs.statSync(file).isFile())throw Error();res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end();}}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];

fs.mkdirSync(out,{recursive:true});

try{
for(const language of ['chn','eng']){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const email=`audit-${language}@local.test`,code=await(await context.request.post(base+'/api/auth/code',{data:{email}})).json();
 const auth=await(await context.request.post(base+'/api/auth/verify',{data:{email,code:code.developmentCode}})).json();
 const password='Local-test-'+crypto.randomUUID();await context.request.put(base+'/api/profile',{data:{nickname:'Audit',grade:GRADES[0],target:TARGETS[0],avatar:[...AVATAR_IDS][0],password,confirmPassword:password}});
 await context.addInitScript(({language,id})=>{localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem(`ddphysics-tour:v4:${encodeURIComponent(id)}`,JSON.stringify({version:4,status:'skipped'}));},{language,id:auth.user.id});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const mode of ['desktop','mobile','dark']){
  await page.setViewportSize(mode==='mobile'?{width:360,height:800}:{width:1440,height:1000});
  for(const [i,route] of ['home','bank','examples','examples?question=ex-101-1','exercises?question=tb-101-1','papers','papers?question=2021%7Cpaper-2%7C2','textbook','textbook?knowledge=2','mistakes','membership','payment','ask','focus'].entries()){
   await page.goto(base+'/#'+route);await page.locator('.app-shell').waitFor();await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),mode==='dark');await page.waitForTimeout(450);await page.evaluate(()=>scrollTo(0,0));
   const checks=await page.locator('main').evaluate(el=>({text:el.innerText.slice(0,2000),overflow:document.documentElement.scrollWidth>innerWidth+2,small:[...el.querySelectorAll('button,a,input,summary')].filter(n=>n.getBoundingClientRect().width&&parseFloat(getComputedStyle(n).fontSize)<12).map(n=>({text:n.textContent.slice(0,45),size:getComputedStyle(n).fontSize})).slice(0,10),brokenImages:[...el.querySelectorAll('img')].filter(n=>n.complete&&!n.naturalWidth).map(n=>n.alt)}));
   results.push({language,mode,route,...checks});await page.screenshot({path:`${out}/${language}-${mode}-${i}.png`});
  }
 }
 await page.getByRole('button',{name:language==='eng'?'Profile settings':'个人设置',exact:true}).click();await page.waitForTimeout(500);await page.screenshot({path:`${out}/${language}-profile.png`});results.push({language,route:'profile',text:await page.locator('main').innerText(),errors});await context.close();
}
const guest=await browser.newContext({viewport:{width:360,height:800}});const login=await guest.newPage();await login.goto(base);await login.locator('.auth-page').waitFor();await login.screenshot({path:out+'/guest-login.png'});results.push({route:'guest-login',overflow:await login.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)});await guest.close();
fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({pages:results.length,overflow:results.filter(r=>r.overflow).map(r=>[r.language,r.mode,r.route]),errors:results.filter(r=>r.errors?.length)}));
}finally{await browser.close();await new Promise(r=>server.close(r));api.close();}
