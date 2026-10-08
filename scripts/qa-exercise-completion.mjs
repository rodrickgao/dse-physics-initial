import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {createApi} from '../server/api.mjs';
import {GRADES,TARGETS,AVATAR_IDS} from '../src/lib/avatar-catalog.js';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const directory=fs.mkdtempSync(join(tmpdir(),'ddphysics-tour-v2-')),out='../output/exercise-completion-20261009';
const api=createApi({directory,localTestEmail:'audit-eng@local.test',contentLimits:{detail:1000,directory:1000,image:3000}});
const root=resolve('dist');const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer((req,res)=>api.handler(req,res,()=>{if(api.protectFiles(req,res))return;try{const pathname=new URL(req.url,'http://localhost').pathname;const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root)||!fs.statSync(file).isFile())throw Error();res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end();}}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];

fs.mkdirSync(out,{recursive:true});



try{
const context=await browser.newContext({viewport:{width:390,height:844}}),email='member-audit@local.test';const c=await(await context.request.post(base+'/api/auth/code',{data:{email}})).json();const a=await(await context.request.post(base+'/api/auth/verify',{data:{email,code:c.developmentCode}})).json();const password='Local-test-'+crypto.randomUUID();await context.request.put(base+'/api/profile',{data:{nickname:'Member audit',grade:GRADES[0],target:TARGETS[0],avatar:[...AVATAR_IDS][0],password,confirmPassword:password}});
await context.request.post(base+'/api/admin/login',{data:{key:fs.readFileSync(api.adminKeyPath,'utf8').trim()}});const granted=await context.request.post(base+'/api/admin/membership',{data:{userId:a.user.id,action:'extend',days:1,reason:'Isolated UI audit',revision:0,requestId:crypto.randomUUID()}});assert.equal(granted.status(),200);

const additions=JSON.parse(fs.readFileSync('scripts/exercise-reasoning-supplements.json','utf8'));
let checked=0;
for(const language of ['chn','eng'])for(const id of Object.keys(additions)){
 const response=await context.request.get(base+'/api/content/question?'+new URLSearchParams({id,language}));assert.equal(response.status(),200,id);
 const q=await response.json();assert.ok(q.reasoning?.length>80,language+' '+id);checked++;
}
for(const language of ['chn','eng']){
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({language,id})=>{localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem(`ddphysics-tour:v4:${encodeURIComponent(id)}`,JSON.stringify({version:4,status:'skipped'}));},{language,id:a.user.id});
 for(const id of ['tb-101-1','tb-202-5','tb-E301-4'])for(const width of [1440,360]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/#exercises?question='+id);
  await page.locator(`[data-exercise="${id}"][aria-busy="false"]`).waitFor();
  const showAnswer=page.getByRole('button',{name:language==='eng'?'Show solution':'查看解答',exact:true});
  if(await showAnswer.count())await showAnswer.click();
  const showReasoning=page.getByRole('button',{name:language==='eng'?'Show explanation':'查看详解',exact:true});
  if(await showReasoning.count())await showReasoning.click();
  await page.locator('.reasoning-content').waitFor();assert.ok((await page.locator('.reasoning-content').innerText()).length>50);
  await page.locator('.question-content img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  if(id==='tb-202-5')assert.ok(await page.locator('img[src*="202-5-complete-axes"]').evaluate(i=>i.naturalWidth>500));
  await page.screenshot({path:`${out}/${language}-${id}-${width}.png`});results.push({language,id,width,passed:true});
 }
 assert.deepEqual(errors,[]);await page.close();
}
fs.writeFileSync(out+'/browser-results.json',JSON.stringify({apiEditions:checked,pages:results},null,2));console.log(JSON.stringify({apiEditions:checked,pages:results.length,passed:true}));
await context.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));api.close();}
