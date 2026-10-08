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
const context=await browser.newContext({viewport:{width:360,height:800}}),email='inspect@local.test';let c=await(await context.request.post(base+'/api/auth/code',{data:{email}})).json();let a=await(await context.request.post(base+'/api/auth/verify',{data:{email,code:c.developmentCode}})).json();let password='Local-test-'+crypto.randomUUID();await context.request.put(base+'/api/profile',{data:{nickname:'Inspect',grade:GRADES[0],target:TARGETS[0],avatar:[...AVATAR_IDS][0],password,confirmPassword:password}});await context.addInitScript(id=>localStorage.setItem(`ddphysics-tour:v4:${encodeURIComponent(id)}`,JSON.stringify({version:4,status:'skipped'})),a.user.id);
const p=await context.newPage();
for(const language of ['chn','eng'])for(const width of [1440,360]){
 await p.setViewportSize({width,height:1000});await p.goto(base);await p.evaluate(lang=>localStorage.setItem('dse-physics-language-v1',lang),language);await p.goto(base+'/#bank');await p.reload();await p.locator('.bank-learning-path').waitFor();
 const cards=p.locator('.bank-learning-path button');assert.equal(await cards.count(),3);const boxes=await cards.evaluateAll(ns=>ns.map(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom,id:n.dataset.tour})));assert.deepEqual(boxes.map(b=>b.id),['bank-examples','bank-exercises','bank-papers']);assert.ok(boxes[1].top>boxes[0].bottom&&boxes[2].top>boxes[1].bottom);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
 await p.screenshot({path:out+`/bank-path-${language}-${width}.png`});
 for(const id of ['examples','exercises','papers']){await p.locator(`[data-tour="bank-${id}"]`).click();assert.ok(p.url().includes('#'+id));await p.goto(base+'/#bank');await p.locator('.bank-learning-path').waitFor();}
}
console.log('PASS: bilingual vertical order, mobile layout and all three destinations');await context.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));api.close();}
