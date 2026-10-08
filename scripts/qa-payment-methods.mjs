import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const directory=mkdtempSync(resolve('../tmp/direct-payment-'));
const base='http://127.0.0.1:5189';
const child=spawn(process.execPath,['server/preview.mjs'],{env:{...process.env,PORT:'5189',DSE_DATA_DIR:directory,SMTP_HOST:''},stdio:'pipe',windowsHide:true});
let browser;
try {
 await new Promise((ok,no)=>{child.stdout.on('data',d=>{if(String(d).includes('5189'))ok();});child.once('exit',c=>no(Error('Preview exited '+c)));child.stderr.on('data',()=>{});});
 browser=await chromium.launch({channel:'chrome',headless:true});
 const adminContext=await browser.newContext();
 const call=async(ctx,path,data,method='POST')=>{const r=await ctx.request.fetch(base+'/api/'+path,data?{method,data}:{method:'GET'});assert.equal(r.status(),200,await r.text());return r.json();};
 await call(adminContext,'admin/login',{key:readFileSync(resolve(directory,'admin-key.txt'),'utf8').trim()});
 const admin=await adminContext.newPage();await admin.goto(base+'/admin.html');
 const out=resolve('../tmp/payment-method-qa');mkdirSync(out,{recursive:true});
 for(const method of ['wechat','alipay']) {
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const email=method+'-direct@example.com';const otp=await call(ctx,'auth/code',{email});await call(ctx,'auth/verify',{email,code:otp.developmentCode});await call(ctx,'profile',{nickname:method+'测试',grade:'中五',target:'5',avatar:'newton-wave',password:'Study-pass-123',confirmPassword:'Study-pass-123'},'PUT');
  const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));let submits=0;p.on('request',r=>{if(r.url().endsWith('/api/orders')&&r.method()==='POST')submits++;});
  await p.goto(base+'/#membership');await p.getByRole('button',{name:'开通 30 天会员',exact:true}).click();
  assert.equal(await p.locator('.payment-code-image').count(),0);await p.locator('.payment-method-'+method).click();await p.locator('.payment-code-image img').evaluate(e=>e.decode());
  assert.equal(await p.locator('input[type="file"]').count(),0);
  await p.getByRole('button',{name:'我已付款',exact:true}).click();
  await p.getByRole('heading',{name:'恭喜，你已开通会员，体验专属功能：',exact:true}).waitFor();
  assert.equal(new URL(p.url()).hash,'#activating');assert.equal(submits,1);
  const membership=(await call(ctx,'membership')).membership;assert.equal(membership.active,true);
  const order=(await call(ctx,'orders')).order;assert.equal(order.payment_method,method);assert.equal(order.status,'pending');
  await admin.getByRole('button',{name:'查看申请',exact:true}).click();
  const row=admin.locator('tr').filter({hasText:email});await row.getByRole('button',{name:'确认通过',exact:true}).waitFor();assert.ok((await row.innerText()).includes('用户已确认付款'));
  await admin.screenshot({path:resolve(out,method+'-pending.png'),fullPage:true});
  await row.getByRole('button',{name:'确认通过',exact:true}).click();await row.getByText('已通过',{exact:false}).waitFor();
  assert.equal((await call(ctx,'membership')).membership.endsAt,membership.endsAt);
  await p.reload();await p.getByRole('heading',{name:'恭喜，你已开通会员，体验专属功能：',exact:true}).waitFor();
  await p.screenshot({path:resolve(out,method+'-success.png'),fullPage:true});
  assert.deepEqual(errors,[]);await ctx.close();
  // Return to overview so the next pending request is announced there.
  await admin.getByRole('button',{name:'总览',exact:true}).click();
 }
 console.log('PASS both QR branches -> one click -> real membership active -> admin pending request -> confirmation without duplicate days; no upload; refresh persists. Isolated local test database only.');
} finally {await browser?.close();child.kill();}

