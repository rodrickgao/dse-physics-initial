import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='../tmp/chinese-examples/browser';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const base='http://127.0.0.1:5178';
async function api(path,data,method='post') {
 const r=await context.request[method](base+'/api/'+path,data?{data}:{});
 assert.ok(r.ok(),`${path}: ${r.status()}`);return r.json();
}
const otp=await api('auth/code',{email:'rodrick_gao@163.com'});
assert.ok(otp.developmentCode,'Preview must use local codes');
await api('auth/verify',{email:'rodrick_gao@163.com',code:otp.developmentCode});
const initial=await api('mistakes',null,'get');const key='ex-101-1';
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('dse-physics-language-v1','chn'));
try {
 await page.goto(base+'/#examples?question='+key);
 await page.locator('[data-example][aria-busy=false]').waitFor();
 assert.equal(await page.locator('.sidebar').evaluate(el=>Math.round(el.getBoundingClientRect().width)),208);
 assert.ok((await page.locator('.question-content img').first().getAttribute('src')).includes('/chn/'));
 assert.equal(await page.locator('.question-mark').count(),2);
 assert.equal(await page.locator('.question-mark').first().innerText(),'');
 assert.equal(await page.locator('.question-mark').first().locator('svg').count(),1);
 await page.locator('.stage-toggle').first().click();
 await page.evaluate(async()=>Promise.all([...document.querySelectorAll('.exercise-reader img')].map(i=>i.decode())));
 await page.screenshot({path:out+'/chinese-desktop.png',fullPage:true});
 await api('progress',{keys:[key],status:'clear'},'put');
 await page.reload();await page.locator('[data-example][aria-busy=false]').waitFor();
 await page.getByRole('button',{name:'标为已掌握',exact:true}).click();
 await page.getByRole('button',{name:'已掌握',exact:true}).waitFor();
 await page.locator('.related-panel button').first().click();
 await page.locator('.knowledge-questions button[data-marked=true]').first().waitFor();
 await page.screenshot({path:out+'/green-knowledge-card.png',fullPage:true});
 await page.goto(base+'/#examples?question='+key);await page.locator('[data-example][aria-busy=false]').waitFor();
 await page.getByRole('button',{name:'加入错题',exact:true}).click();
 await page.getByRole('button',{name:'已加入错题',exact:true}).waitFor();
 assert.ok((await api('mistakes',null,'get')).mistakes[key]);
 await page.locator('.language-switch').click();
 await page.waitForFunction(()=>document.querySelector('.question-content math'));
 assert.ok(await page.locator('.question-content math').count());
 await page.locator('.language-switch').click();
 await page.waitForFunction(()=>document.querySelector('.question-content img')?.getAttribute('src').includes('/chn/'));
 for(const width of [1024,390,320]) {
  await page.setViewportSize({width,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${width}`);
  await page.screenshot({path:out+`/chinese-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/#examples');await page.locator('.example-search').fill('笨豬跳');
 await page.locator('.exercise-list button').filter({hasText:'206'}).first().waitFor();
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/result.json',JSON.stringify({passed:true,viewports:[1440,1024,390,320],checks:['Chinese source images','English switch','Chinese search','single icons','mastery persistence','mistake persistence','green knowledge cards','208px sidebar','mobile overflow']},null,2));
 console.log('Chinese examples UI verified');
} catch(e) {await page.screenshot({path:out+'/failure.png',fullPage:true});throw e;}
finally {
 await api('progress',{keys:[key],status:initial.mastered?.[key]?'mastered':'clear'},'put');
 if(!initial.mastered?.[key])await api('mistakes',{key,marked:!!initial.mistakes?.[key]},'put');
 await browser.close();
}
