import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture,output} from './deep-test-fixture.mjs';
const f=await fixture('account-switch'),first=f.client(),second=f.client();
const one=await f.register(first,'tab-one@local.test','账户一'),two=await f.register(second,'tab-two@local.test','账户二');
await first.call('mistakes/import',{keys:['ex-101-1']});await second.call('mistakes/import',{keys:['tb-101-1']});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({reducedMotion:'reduce'});
for(const [name,value]of first.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
await context.addInitScript(ids=>{for(const id of ids)localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped'}));},[one.id,two.id]);
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let report={passed:false};
try{
 await page.goto(f.base+'#mistakes');await page.locator('[data-mistake="ex-101-1"]').waitFor();
 assert.ok((await context.request.post(f.base+'api/auth/logout',{data:{}})).ok());
 assert.ok((await context.request.post(f.base+'api/auth/password',{data:{email:two.email,password:'Deep-local-test-123'}})).ok());
 await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.waitForTimeout(1500);
 report={accountText:await page.locator('.account-bar').innerText(),otherProgressVisible:await page.locator('[data-mistake="tb-101-1"]').count()>0,errors};
 report.passed=report.accountText.includes('账户二')&&!report.accountText.includes('账户一')&&errors.length===0;
 if(report.passed){
  await page.goto(f.base+'#mistakes');await page.locator('[data-mistake="tb-101-1"]').waitFor();assert.equal(await page.locator('[data-mistake="ex-101-1"]').count(),0);report.progressMatchesAccount=true;
  const pending=f.client(),email='tab-incomplete@local.test',code=(await pending.call('auth/code',{email})).data.developmentCode;
  assert.equal((await pending.call('auth/verify',{email,code})).status,200);
  await context.addCookies([{name:'dse_session',value:pending.jar.get('dse_session'),url:f.base,httpOnly:true,sameSite:'Strict'}]);
  await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.locator('.profile-registration').waitFor();report.incompleteAccountShowsRegistration=true;
  assert.ok((await context.request.post(f.base+'api/auth/logout',{data:{}})).ok());
  await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.locator('.login-page').waitFor();report.incompleteAccountLogoutReturnsToLogin=true;
 }
 console.log(JSON.stringify(report));
}finally{fs.writeFileSync(path.join(output,process.env.DSE_AUTH_INITIAL?'account-switch-initial.json':'account-switch-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
