import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {createApi} from '../server/api.mjs';
import {GRADES,TARGETS,AVATAR_IDS} from '../src/lib/avatar-catalog.js';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const directory=fs.mkdtempSync(join(tmpdir(),'ddphysics-tour-v2-')),out='../output/site-review-20261009';
const api=createApi({directory});
const root=resolve('dist');const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer((req,res)=>api.handler(req,res,()=>{if(api.protectFiles(req,res))return;try{const pathname=new URL(req.url,'http://localhost').pathname;const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root)||!fs.statSync(file).isFile())throw Error();res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end();}}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];

fs.mkdirSync(out,{recursive:true});


try{
const context=await browser.newContext({viewport:{width:360,height:800}}),email='inspect@local.test';let c=await(await context.request.post(base+'/api/auth/code',{data:{email}})).json();let a=await(await context.request.post(base+'/api/auth/verify',{data:{email,code:c.developmentCode}})).json();let password='Local-test-'+crypto.randomUUID();await context.request.put(base+'/api/profile',{data:{nickname:'Inspect',grade:GRADES[0],target:TARGETS[0],avatar:[...AVATAR_IDS][0],password,confirmPassword:password}});await context.addInitScript(id=>localStorage.setItem(`ddphysics-tour:v4:${encodeURIComponent(id)}`,JSON.stringify({version:4,status:'skipped'})),a.user.id);const p=await context.newPage();await p.goto(base+'/#examples?question=ex-101-1');await p.locator('.study-content table').waitFor();console.log(JSON.stringify(await p.locator('.study-content table').evaluate(t=>{let nodes=[];for(let n=t;n&&nodes.length<6;n=n.parentElement){const c=getComputedStyle(n);nodes.push({tag:n.tagName,cls:n.className,width:n.clientWidth,scroll:n.scrollWidth,overflow:c.overflowX,display:c.display,style:n.getAttribute('style')});}return {nodes,html:t.outerHTML.slice(0,1800)};})));await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));api.close();}
