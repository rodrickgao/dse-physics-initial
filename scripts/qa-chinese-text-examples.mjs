import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='../tmp/chinese-text-examples/browser';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050}});
const base='http://127.0.0.1:5178';
const code=await (await context.request.post(base+'/api/auth/code',{data:{email:'rodrick_gao@163.com'}})).json();
assert.ok(code.developmentCode);
assert.ok((await context.request.post(base+'/api/auth/verify',{data:{email:'rodrick_gao@163.com',code:code.developmentCode}})).ok());
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('dse-physics-language-v1','chn'));
const samples=['ex-101-1','ex-102-1','ex-105-9','ex-202-12','ex-3A03-1','ex-E103-9','ex-E202-11','ex-E403-6'];
try{
 for(const id of samples){
  await page.goto(base+'/#examples?question='+id);await page.locator('[data-example][aria-busy=false]').waitFor();
  assert.match(await page.locator('.question-content').first().innerText(),/[\u3400-\u9fff]/);
  await page.getByRole('button',{name:'查看解答',exact:true}).click();
  const think=page.getByRole('button',{name:'查看思考题解答',exact:true});
  if(await think.count()){await think.click();assert.match(await page.locator('.example-supplement').innerText(),/[\u3400-\u9fff]/);}
  assert.equal(await page.locator('.example-notes').count(),0);
  assert.equal(await page.locator('.katex-error,[data-math]').count(),0);
  assert.equal(await page.locator('img[src*="-question-"],img[src*="-answer-"]').count(),0);
  await page.evaluate(async()=>Promise.all([...document.querySelectorAll('.exercise-reader img')].map(i=>i.decode())));
  await page.screenshot({path:out+'/'+id+'.png',fullPage:true});
 }
 await page.goto(base+'/#examples?question=ex-102-1');await page.locator('[data-example][aria-busy=false]').waitFor();
 await page.getByRole('button',{name:'查看解答',exact:true}).click();await page.getByRole('button',{name:'查看思考题解答',exact:true}).click();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:950});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow '+width);
  await page.screenshot({path:out+'/mobile-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1050});
 await page.locator('.language-switch').click();await page.waitForFunction(()=>document.querySelector('.question-content')?.textContent.includes('hot'));
 await page.getByRole('button',{name:'Show solution',exact:true}).click();
 await page.getByRole('button',{name:'Show Think about answer',exact:true}).click();
 assert.match(await page.locator('.example-supplement').innerText(),/cooled air/i);
 await page.locator('.language-switch').click();await page.waitForFunction(()=>/[\u3400-\u9fff]/.test(document.querySelector('.question-content')?.textContent||''));
 await page.goto(base+'/#examples?question=ex-E202-11');await page.locator('[data-example][aria-busy=false]').waitFor();
 await page.getByRole('button',{name:'查看解答',exact:true}).click();
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:950});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Formula overflow '+width);
  assert.ok(await page.locator('.katex').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1||getComputedStyle(n).overflowX==='auto')),'Formula must fit or scroll');
  await page.screenshot({path:out+'/formula-'+width+'.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/result.json',JSON.stringify({passed:true,samples,mobile:[390,320],languageSwitch:true,thinkAnswers:true},null,2));
 console.log('Editable Chinese examples UI passed');
}finally{await browser.close();}
