import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base='http://127.0.0.1:5178';const b=await chromium.launch({channel:'chrome',headless:true});const c=await b.newContext();
try{
 const email='free@local.test';const otp=await(await c.request.post(base+'/api/auth/code',{data:{email}})).json();assert.ok(otp.developmentCode,'local code required');const login=await(await c.request.post(base+'/api/auth/verify',{data:{email,code:otp.developmentCode}})).json();assert.ok(login.user?.profileComplete,'existing free profile');const m=await(await c.request.get(base+'/api/membership')).json();assert.equal(m.membership.active,false);
 const p=await c.newPage();await p.goto(base+'/#exercises?question=tb-202-1');await p.locator('.study-flow[aria-busy=false]').waitFor();await p.locator('.stage-toggle').first().click();assert.ok(await p.locator('.official-content').innerText());assert.equal(await p.locator('.exercise-knowledge button').count(),0);
 await p.goto(base+'/#examples?question=ex-202-4');await p.locator('.study-flow[aria-busy=false]').waitFor();assert.equal(await p.locator('.related-panel button').count(),0);
 await p.goto(base+'/#bank');await p.locator('#bank-search').fill('加速度');await p.waitForFunction(()=>document.querySelector('.bank-search-results')?.getAttribute('aria-busy')==='false');await p.locator('.bank-search-result').first().waitFor();assert.ok((await p.locator('.bank-search-result').filter({has:p.locator('.search-source',{hasText:'知识点'})}).first().locator('span').innerText()).length<80);
 console.log('Free account restrictions preserved');
}finally{await b.close();}
