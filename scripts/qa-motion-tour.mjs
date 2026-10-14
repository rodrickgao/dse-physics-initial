import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';
const output=path.resolve('../output/site-motion-20261014/tutorial');fs.mkdirSync(output,{recursive:true});
const f=await fixture('motion-tour'),browser=await chromium.launch({channel:'chrome',headless:true});
const report={tours:[],errors:[]};let lastPage;
try{
 for(const language of ['chn','eng'])for(const reduced of [false,true]){
  f.advance(61000);const client=f.client(),user=await f.register(client,`motion-tour-${language}-${reduced}@local.test`);
  const viewport=language==='chn'?{width:1440,height:1000}:{width:390,height:844};
  const context=await browser.newContext({viewport,hasTouch:language==='eng',reducedMotion:reduced?'reduce':'no-preference'});
  for(const[name,value]of client.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(language=>localStorage.setItem('dse-physics-language-v1',language),language);
  const page=await context.newPage();lastPage=page;page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(f.base);await page.locator('.tour-panel[data-tour-step="welcome"]').waitFor();
  await page.getByRole('button',{name:language==='chn'?'开始体验':'Start exploring',exact:true}).click();
  const visited=[];
  async function ready(id){
   const panel=page.locator(`.tour-panel[data-tour-step="${id}"]:not(.tour-pending)`);await panel.waitFor();await page.waitForTimeout(300);
   const style=await panel.evaluate(n=>({opacity:getComputedStyle(n).opacity,transition:getComputedStyle(n).transitionDuration,bodyAnimation:getComputedStyle(n.querySelector('#tour-body')).animationName,box:n.getBoundingClientRect().toJSON()}));
   assert.equal(style.opacity,'1');assert.ok(style.box.x>=0&&style.box.y>=0&&style.box.right<=viewport.width+1&&style.box.bottom<=viewport.height+1);
   if(reduced)assert.equal(style.bodyAnimation,'none');else assert.equal(style.bodyAnimation,'tour-reveal');
   visited.push({id,...style});return panel;
  }
  for(const [id,target]of [['open','example-chapter-101'],['solution','example-solution'],['mastered','mark-mastered'],['mark','mark-mistake'],['mistake-review','tour-mistake-open'],['question-knowledge','question-knowledge'],['knowledge-question','knowledge-question-2']]){
   await ready(id);await page.locator(`[data-tour="${target}"]`).filter({visible:true}).first().click();
  }
  const eight=await ready('analysis-open');assert.ok(await page.locator('[data-tour="knowledge-profile"]').evaluate(n=>n.inert));await eight.locator('footer button').last().click();
  await ready('analysis-report');await page.locator('.home-weak-topic>a').first().click();
  const replay=await ready('replay');assert.ok(page.url().includes('#textbook'));await replay.locator('footer button').last().click();
  await page.locator('.tour-panel[data-tour-step="done"]').waitFor();await page.locator('.tour-panel footer button').click();
  const saved=await page.evaluate(id=>JSON.parse(localStorage.getItem('ddphysics-tour:v4:'+encodeURIComponent(id))),user.id);
  assert.equal(saved.status,'completed');assert.equal(saved.lastCompleted,9);assert.deepEqual(saved.skippedSteps,[]);
  report.tours.push({language,viewport,reduced,visited,steps:10,completed:true,passed:true});console.log(`PASS tour ${language} ${reduced?'reduced':'animated'}`);await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(output,'failure.png')});throw error;}
finally{fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
