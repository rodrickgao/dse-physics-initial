import sharp from 'sharp';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const directory=mkdtempSync(join(tmpdir(),'dse-payment-browser-'));
const base='http://127.0.0.1:5187',env={...process.env,PORT:'5187',DSE_DATA_DIR:directory};delete env.SMTP_HOST;
const child=spawn(process.execPath,['server/dev.mjs'],{env,stdio:'pipe',windowsHide:true});let browser; child.stderr.on('data',d=>process.stderr.write(d));
try {
 await new Promise((r,j)=>{child.stdout.on('data',d=>{if(String(d).includes('5187'))r();});child.once('exit',c=>j(Error('exit '+c)));});
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});
 context.setDefaultTimeout(60000); context.setDefaultNavigationTimeout(60000);
 const api=async(path,body,method='POST')=>{const r=await context.request.fetch(base+'/api/'+path,body?{method,data:body}:{method:'GET'});assert.equal(r.status(),200,await r.text());return r.json();};
 const otp=await api('auth/code',{email:'payment-qa@example.com'});await api('auth/verify',{email:'payment-qa@example.com',code:otp.developmentCode});await api('profile',{nickname:'付款测试',grade:'中五',target:'5',avatar:'newton-wave',password:'Study-pass-123',confirmPassword:'Study-pass-123'},'PUT');
 const errors=[];const student=await context.newPage(),admin=await context.newPage();for(const page of [student,admin])page.on('pageerror',e=>errors.push(e.message));
 console.log('Student payment'); await student.goto(base+'/#membership');await student.getByRole('button',{name:'订阅',exact:true}).click(); assert.equal(new URL(student.url()).hash,'#payment'); await student.getByRole('heading',{name:'扫码支付 · 30 天会员',exact:true}).waitFor(); assert.equal(await student.getByLabel('付款成功截图').count(),0); await student.getByRole('button',{name:'我已付款',exact:true}).click(); assert.equal(new URL(student.url()).hash,'#receipt'); await student.getByRole('heading',{name:'上传付款截图',exact:true}).waitFor(); assert.equal(await student.getByRole('button',{name:'已上传',exact:true}).isDisabled(),true); mkdirSync(resolve('../tmp/payment-qa'),{recursive:true}); if (!process.env.SKIP_QA_SCREENSHOTS) await student.screenshot({path:resolve('../tmp/payment-qa/upload.png'),fullPage:true}); await student.getByLabel('付款成功截图').setInputFiles({name:'receipt.png',mimeType:'image/png',buffer:await sharp({create:{width:600,height:900,channels:3,background:'#d9f9df'}}).png().toBuffer()}); await student.getByRole('button',{name:'已上传',exact:true}).click(); const submittedAt=Date.now(); await student.getByRole('status').filter({hasText:'正在开通'}).waitFor(); assert.equal((await api('membership')).membership.active,true); await student.getByRole('status').filter({hasText:'正在核实付款信息'}).waitFor(); await student.getByRole('status').filter({hasText:'马上开通'}).waitFor(); await student.getByRole('heading',{name:'恭喜，你已开通会员，体验专属功能：',exact:true}).waitFor(); assert.ok(Date.now()-submittedAt >= 4900); assert.equal(new URL(student.url()).hash,'#member-success');
 console.log('Admin login'); await admin.goto(base+'/admin.html');await admin.getByLabel('管理密钥').fill(readFileSync(join(directory,'admin-key.txt'),'utf8').trim());await admin.getByRole('button',{name:'进入管理后台',exact:true}).click();
 await admin.getByRole('button',{name:'查看申请',exact:true}).click();await admin.getByRole('button',{name:'确认通过',exact:true}).waitFor();
 const receiptLink=await admin.getByRole('link',{name:'查看截图 ↗',exact:true}).getAttribute('href'); const receiptResponse=await context.request.get(base+receiptLink); assert.equal(receiptResponse.status(),200); assert.equal(receiptResponse.headers()['content-type'],'image/webp'); assert.ok((await sharp(await receiptResponse.body()).metadata()).width > 0);
 const out=resolve('../tmp/payment-qa');mkdirSync(out,{recursive:true});if (!process.env.SKIP_QA_SCREENSHOTS) await admin.screenshot({path:join(out,'pending.png'),fullPage:true});
 await admin.getByRole('button',{name:'确认通过',exact:true}).click();assert.equal((await api('membership')).membership.revision,1);
 await student.locator('.membership-status').filter({hasText:'会员至'}).waitFor({timeout:20000});assert.equal((await api('membership')).membership.revision,1);
 assert.equal(await student.getByLabel('付款成功截图').count(),0); await student.getByRole('button',{name:'开通会员',exact:true}).first().click(); assert.equal(await student.getByRole('button',{name:'已订阅',exact:true}).isDisabled(),true); if (!process.env.SKIP_QA_SCREENSHOTS) await student.screenshot({path:join(out,'approved.png'),fullPage:true});await student.setViewportSize({width:390,height:844});assert.ok(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if (!process.env.SKIP_QA_SCREENSHOTS) await student.screenshot({path:join(out,'mobile.png'),fullPage:true});const receipt='data:image/png;base64,'+(await sharp({create:{width:100,height:200,channels:3,background:'#ffffff'}}).png().toBuffer()).toString('base64'); await api('orders',{requestId:crypto.randomUUID(),receipt}); await admin.getByRole('button',{name:'不通过',exact:true}).click(); assert.equal(await admin.getByRole('button',{name:'确认不通过',exact:true}).isDisabled(),true); await admin.getByLabel('不通过理由').fill('付款截图金额不符'); await admin.getByRole('button',{name:'确认不通过',exact:true}).click(); await admin.getByText('暂停理由：付款截图金额不符').waitFor(); assert.equal((await api('membership')).membership.active,false); assert.deepEqual(errors,[]);console.log('Payment browser flow PASS');
}finally{await browser?.close();child.kill();}


