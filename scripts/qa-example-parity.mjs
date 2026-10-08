import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const output='../output/example-parity-20261008/browser';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1050}});
const base='http://127.0.0.1:5178';
const errors=[],results=[];
try{
 const code=await (await context.request.post(base+'/api/auth/code',{data:{email:'rodrick_gao@163.com'}})).json();
 assert.ok(code.developmentCode);
 assert.ok((await context.request.post(base+'/api/auth/verify',{data:{email:'rodrick_gao@163.com',code:code.developmentCode}})).ok());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const samples=['ex-401-3','ex-202-7','ex-206-5','ex-3A03-4','ex-3B05-8','ex-406-9','ex-502-5','ex-E202-11','ex-E402-9'];
 await page.addInitScript(()=>localStorage.setItem('dse-physics-language-v1','chn'));
 for(const id of samples){
  await page.goto(base+'/#examples?question='+id);
  await page.locator('[data-example][aria-busy=false]').waitFor();
  assert.match(await page.locator('.question-content').first().innerText(),/[\u3400-\u9fff]/);
  const show=page.getByRole('button',{name:'查看解答',exact:true});if(await show.count())await show.click();
  const think=page.getByRole('button',{name:'查看思考题解答',exact:true});if(await think.count())await think.click();
  await page.evaluate(async()=>Promise.all([...document.querySelectorAll('.exercise-reader img')].map(i=>i.decode())));
  assert.equal(await page.locator('.katex-error,[data-math]').count(),0);
  const images=await page.locator('.exercise-reader img').evaluateAll(nodes=>nodes.map(i=>({src:i.getAttribute('src'),width:i.naturalWidth,height:i.naturalHeight})));
  assert.ok(images.every(i=>i.width>0&&i.height>0));
  if(id==='ex-401-3'){
   assert.match(await page.locator('.question-content').first().innerText(),/圖 c/);
   assert.match(await page.locator('.exercise-reader').innerText(),/極化/);
   assert.equal(images[0].width>800,true,'Full composite must retain the master image resolution');
  }
  await page.screenshot({path:output+'/'+id+'-chn.png',fullPage:true});
  results.push({id,images:images.length,loaded:true});
 }
 await page.goto(base+'/#examples?question=ex-401-3');await page.locator('[data-example][aria-busy=false]').waitFor();
 const chineseImage=await page.locator('.question-content img').first().getAttribute('src');
 await page.locator('.language-switch').click();
 await page.waitForFunction(()=>document.querySelector('.question-content')?.textContent.includes('When a Van'));
 const englishImage=await page.locator('.question-content img').first().getAttribute('src');
 assert.equal(chineseImage,englishImage,'Same complete composite artwork in both languages');
 await page.screenshot({path:output+'/ex-401-3-eng.png',fullPage:true});
 await page.locator('.language-switch').click();
 await page.waitForFunction(()=>/[\u3400-\u9fff]/.test(document.querySelector('.question-content')?.textContent||''));
 for(const width of [390,320]){
  await page.setViewportSize({width,height:950});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow '+width);
  await page.screenshot({path:output+'/ex-401-3-mobile-'+width+'.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(output+'/result.json',JSON.stringify({passed:true,samples:results,languageSwitch:true,completeComposite:true,mobile:[390,320],errors},null,2));
 console.log('Bilingual example UI verification passed: '+samples.length+' examples, language switch, composite diagram and mobile widths.');
}finally{await browser.close();}
