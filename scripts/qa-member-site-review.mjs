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
const context=await browser.newContext({viewport:{width:390,height:844}}),email='member-audit@local.test';const c=await(await context.request.post(base+'/api/auth/code',{data:{email}})).json();const a=await(await context.request.post(base+'/api/auth/verify',{data:{email,code:c.developmentCode}})).json();const password='Local-test-'+crypto.randomUUID();await context.request.put(base+'/api/profile',{data:{nickname:'Member audit',grade:GRADES[0],target:TARGETS[0],avatar:[...AVATAR_IDS][0],password,confirmPassword:password}});
await context.request.post(base+'/api/admin/login',{data:{key:fs.readFileSync(api.adminKeyPath,'utf8').trim()}});const granted=await context.request.post(base+'/api/admin/membership',{data:{userId:a.user.id,action:'extend',days:1,reason:'Isolated UI audit',revision:0,requestId:crypto.randomUUID()}});assert.equal(granted.status(),200);
await context.addInitScript(id=>{localStorage.setItem('dse-physics-language-v1','eng');localStorage.setItem(`ddphysics-tour:v4:${encodeURIComponent(id)}`,JSON.stringify({version:4,status:'skipped'}));},a.user.id);
const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
for(const route of ['membership','ask','examples?question=ex-401-3','papers?question=2021%7Cpaper-2%7C2']){await p.goto(base+'/#'+route);await p.locator('.app-shell').waitFor();await p.waitForTimeout(700);await p.evaluate(()=>scrollTo(0,0));results.push({route,text:(await p.locator('main').innerText()).slice(0,2200),overflow:await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)});await p.screenshot({path:out+'/member-'+route.split('?')[0]+'.png'});}
assert.equal(await p.locator('.member-notice').count(),0);assert.deepEqual(errors,[]);fs.writeFileSync(out+'/member-results.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({passed:true,pages:results.length,overflow:results.filter(r=>r.overflow)}));await context.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));api.close();}
