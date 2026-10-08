import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const base='http://127.0.0.1:5178',out='../output/content-protection';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const sent=await (await context.request.post(base+'/api/auth/code',{data:{email:'rodrick_gao@163.com'}})).json();
assert.ok(sent.developmentCode,'local OTP available');
assert.ok((await context.request.post(base+'/api/auth/verify',{data:{email:'rodrick_gao@163.com',code:sent.developmentCode}})).ok());
const page=await context.newPage(),errors=[],contentRequests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/content/'))contentRequests.push(new URL(r.url()).pathname);});
await page.addInitScript(()=>localStorage.setItem('dse-physics-language-v1','chn'));
try {
 for(const [route,selector] of [['examples?question=ex-101-1','[data-example][aria-busy=false]'],['exercises?question=tb-101-1','[data-exercise][aria-busy=false]'],['papers?question=2025%7Cpaper-1a%7C1','[data-question][aria-busy=false]']]) {
  console.log('Checking reader',route);await page.goto(base+'/#'+route);await page.locator(selector).waitFor();
  await page.getByRole('button',{name:'查看解答',exact:true}).click();
  await page.evaluate(async()=>Promise.all([...document.querySelectorAll('.question-card img')].map(i=>i.decode())));
  if(route.startsWith('papers')){await page.getByRole('button',{name:'查看详解',exact:true}).click();assert.match(await page.locator('.reasoning-content').innerText(),/DDPhysics · U-/);}
  await page.getByRole('button',{name:'下一题',exact:true}).click();await page.locator(selector).waitFor();
  if(route.startsWith('papers')){await page.goto(base+'/#papers?question=2019%7Cpaper-1a%7C1');await page.locator('[data-question][aria-busy=false]').waitFor();await page.getByRole('button',{name:/考生表现报告/}).click();await page.locator('.scan-stack img').first().waitFor();await page.evaluate(async()=>Promise.all([...document.querySelectorAll('.scan-stack img')].map(i=>i.decode())));}
 }
 await page.goto(base+'/#examples');await page.locator('.book-card').first().click();await page.locator('.exercise-directory button').first().click();await page.locator('[data-example][aria-busy=false]').waitFor();
 await page.locator('.language-switch').click();await page.waitForFunction(()=>document.querySelector('.question-content')?.textContent.includes('thermometer'));
 await page.goto(base+'/#bank?q=heat');await page.locator('.bank-search-result').first().waitFor();assert.ok(await page.locator('.bank-search-result').count()<=30);
 await page.getByRole('button',{name:'Next page',exact:true}).click();await page.locator('.bank-search-result').first().waitFor();
 await page.locator('.bank-search-result').first().click();await page.locator('.question-content').first().waitFor();
 await page.goto(base+'/#textbook?knowledge=2');await page.locator('[data-study-knowledge-card]').first().waitFor();await page.locator('.knowledge-questions button').first().waitFor();
 await page.screenshot({path:out+'/knowledge-links.png',fullPage:false});
 await page.goto(base+'/#mistakes');await page.locator('.mistakes-view').waitFor();
 await page.goto(base+'/#examples?question=ex-102-1');await page.locator('[data-example][aria-busy=false]').waitFor();await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/mobile-example.png',fullPage:true});
 assert.deepEqual(errors,[]);
 const result={passed:true,checks:['single-question readers','answers and private reasoning watermark','next question','original report pages','chapter directory','language switch','server search and next page','knowledge links','mistakes page','mobile layout'],contentRequests:contentRequests.length,pageErrors:errors};
 fs.writeFileSync(out+'/browser-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){await page.screenshot({path:out+'/failure.png',fullPage:true});console.log('Failed page',page.url());throw error;}finally{await browser.close();}
