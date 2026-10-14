import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';
import {questions,points} from '../server/catalog.mjs';
import {topicsInBookOrder} from '../src/lib/topic-display-order.js';

const output=path.resolve('../output/home-weak-topics-20261013');fs.mkdirSync(output,{recursive:true});
const f=await fixture('home-weak-browser'),browser=await chromium.launch({channel:'chrome',headless:true});
const report={views:[],tours:[],edgeCases:[],errors:[]};let lastPage;
const saved=['tb-101-1','tb-502-1','tb-E303-22','ex-103-1','tb-203-1','tb-401-1'];
const modes=[{width:1440,height:1000},{width:1024,height:768},{width:390,height:844},{width:320,height:740}];
async function contextFor(client,user,language,mode,resume=false){
 const context=await browser.newContext({viewport:mode,hasTouch:mode.width<1100,reducedMotion:mode.width===320?'reduce':'no-preference'});
 for(const [name,value] of client.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
 await context.addInitScript(({id,language,resume})=>{try{
  localStorage.setItem('dse-physics-language-v1',language);
  localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:resume?'in-progress':'skipped',lastCompleted:resume?6:-1,skippedSteps:[],pages:{}}));
 }catch{}},{id:user.id,language,resume});
 context.on('page',page=>{page.on('pageerror',e=>report.errors.push(e.message));});return context;
}
const list=async client=>{const r=await client.call('weak-topics');assert.equal(r.status,200);return r.data.weak_points;};
const reviewBody=p=>({knowledge_id:p.knowledge_id,revision:p.revision});
try{
 for(const member of [false,true]){
  const client=f.client(),user=await f.register(client,`weak-browser-${member}@local.test`);
  if(member)f.db.prepare('INSERT INTO memberships VALUES(?,?,0,1)').run(user.id,f.clock()+30*86400000);
  assert.equal((await client.call('mistakes/import',{keys:saved})).status,200);
  await list(client);
  for(const language of ['chn','eng'])for(const mode of modes){
   f.advance(61000);f.db.prepare('DELETE FROM weak_topic_reviews WHERE user_id=?').run(user.id);
   const context=await contextFor(client,user,language,mode),page=await context.newPage();lastPage=page;
   const before=(await client.call('mistakes')).data;
   await page.goto(f.base+'#home');await page.locator('.home-weak-topic').first().waitFor();
   const expected=await list(client);assert.ok(expected.length>3);
   assert.deepEqual(await page.locator('[data-review-topic]').evaluateAll(ns=>ns.map(n=>n.dataset.reviewTopic)),topicsInBookOrder(expected.slice(0,3)).map(p=>p.knowledge_id));
   assert.equal(await page.locator('.weak-topic-dismiss').count(),0);assert.equal(await page.locator('[data-topic-practice],.qdna-question-grid').count(),0);
   const toggle=page.locator('.student-topic-disclosure button');await toggle.click();
   assert.deepEqual(await page.locator('[data-review-topic]').evaluateAll(ns=>ns.map(n=>n.dataset.reviewTopic)),topicsInBookOrder(expected).map(p=>p.knowledge_id));
   assert.ok(await toggle.evaluate(node=>node.getBoundingClientRect().top>=node.closest('section').querySelector('.student-weak-points').getBoundingClientRect().bottom));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   if(member&&language==='chn'&&mode.width===1440)await page.screenshot({path:path.join(output,'home-expanded.png'),fullPage:true});
   await toggle.click();assert.equal(await page.locator('[data-review-topic]').count(),3);
   const node=page.locator('[data-review-topic]').first(),id=await node.getAttribute('data-review-topic'),p=expected.find(p=>p.knowledge_id===id);
   const viewed=page.waitForResponse(r=>r.url().includes('/api/weak-topics/viewed'));
   await node.locator('a').click();assert.equal((await viewed).status(),200);
   assert.ok(await page.locator('[data-knowledge-sequences]').evaluateAll((ns,id)=>ns.some(n=>n.dataset.knowledgeSequences.split(',').includes(id)),id));
   await page.goBack();await page.locator(`[data-review-topic="${id}"] .weak-topic-dismiss`).waitFor();
   if(language==='chn'&&member&&(mode.width===1440||mode.width===390))await page.screenshot({path:path.join(output,`home-reviewed-${mode.width}.png`),fullPage:true});
   const cross=page.locator(`[data-review-topic="${id}"] .weak-topic-dismiss`);
   if(member&&language==='chn'&&mode.width===1440){
    await page.route('**/api/weak-topics/dismiss*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'保存失败，请重试。'})}));
    await cross.click();await page.locator('[data-tour="knowledge-profile"] [role="alert"]').waitFor();
    assert.equal(await page.locator(`[data-review-topic="${id}"]`).count(),1,'failed save keeps topic');
    await page.unroute('**/api/weak-topics/dismiss*');
   }
   await cross.click();await page.locator(`[data-review-topic="${id}"]`).waitFor({state:'detached'});
   await page.reload();await page.locator('.home-weak-topic').first().waitFor();
   assert.equal((await list(client)).some(x=>x.topic_key===p.topic_key),false);
   assert.deepEqual((await client.call('mistakes')).data,before,'reading/dismissal preserves all marks');
   await page.goto(f.base+'#mistakes');await page.locator('[data-mistake]').first().waitFor();
   assert.equal(await page.locator('[data-tour="knowledge-profile"],.student-topic-guidance,.qdna-recommendations').count(),0);
   const related=[...questions.values()].find(q=>q.source==='textbook'&&q.points.some(id=>String(points.get(id).card_sequence)===p.topic_key));assert.ok(related);
   assert.equal((await client.call('progress',{keys:[related.key],status:'mastered'},'PUT')).status,200);
   assert.equal((await client.call('progress',{keys:[related.key],status:'mistake'},'PUT')).status,200);
   await page.goto(f.base+'#home');await page.locator('.home-weak-topic').first().waitFor();
   if(await page.locator('.student-topic-disclosure button').count())await page.locator('.student-topic-disclosure button').click();
   const revived=(await list(client)).find(x=>x.topic_key===p.topic_key);assert.ok(revived);assert.equal(revived.can_dismiss,false);
   await page.locator(`[data-review-topic="${revived.knowledge_id}"]`).waitFor();
   assert.equal(await page.locator(`[data-review-topic="${revived.knowledge_id}"] .weak-topic-dismiss`).count(),0);
   report.views.push({member,language,...mode,topThree:true,orderedExpansion:true,viewBeforeCross:true,persistedDismissal:true,newMistakeRestores:true,noPractice:true,mistakesClean:true,passed:true});
   await context.close();console.log(`PASS ${member?'member':'free'} ${language} ${mode.width}`);
  }
 }
 // A failed view cannot unlock dismissal; all-hidden accounts have a clean empty state.
 {
  f.advance(61000);const client=f.client(),user=await f.register(client,'weak-edge@local.test');
  await client.call('mistakes/import',{keys:['tb-101-1']});
  const context=await contextFor(client,user,'chn',modes[0]),page=await context.newPage();lastPage=page;
  await page.goto(f.base+'#home');await page.locator('.home-weak-topic').first().waitFor();
  await page.route('**/api/weak-topics/viewed',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'查看状态保存失败，请重试。'})}));
  await page.locator('.home-weak-topic>a').first().click();await page.locator('.textbook-view>[role="alert"]').waitFor();
  assert.ok((await list(client)).every(p=>!p.can_dismiss));await page.unroute('**/api/weak-topics/viewed');
  const viewed=page.waitForResponse(r=>r.url().includes('/api/weak-topics/viewed'));await page.locator('.textbook-view>[role="alert"] button').click();assert.equal((await viewed).status(),200);
  await page.goBack();await page.locator('.weak-topic-dismiss').waitFor();
  for(const p of await list(client)){assert.equal((await client.call('weak-topics/viewed',reviewBody(p))).status,200);assert.equal((await client.call('weak-topics/dismiss',reviewBody(p))).status,200);}
  await page.reload();await page.locator('.student-learning-guide .qdna-note').waitFor();assert.equal(await page.locator('.home-weak-topic,.student-topic-disclosure').count(),0);
  const other=f.client();assert.equal((await other.call('auth/password',{email:'weak-edge@local.test',password:'Deep-local-test-123'})).status,200);
  assert.deepEqual(await list(other),[],'new login keeps dismissals');
  assert.equal((await client.call('progress',{keys:['tb-101-1'],status:'mastered'},'PUT')).status,200);
  assert.equal((await client.call('progress',{keys:['tb-101-1'],status:'mistake'},'PUT')).status,200);
  await page.reload();await page.locator('.home-weak-topic').first().waitFor();assert.equal(await page.locator('.weak-topic-dismiss').count(),0);
  report.edgeCases.push({failedViewRetry:true,allHiddenEmpty:true,newLoginPersists:true,newWrongRepopulates:true,passed:true});await context.close();
 }
 // Resume at step eight, check its lock, then use the topic in step nine.
 for(const language of ['chn','eng']){
  f.advance(61000);const client=f.client(),user=await f.register(client,`weak-tour-${language}@local.test`);
  await client.call('mistakes/import',{keys:saved});const mode=language==='chn'?modes[0]:modes[2];
  const context=await contextFor(client,user,language,mode,true),page=await context.newPage();lastPage=page;
  await page.goto(f.base);await page.getByRole('button',{name:language==='chn'?'继续教程':'Resume tour',exact:true}).click();
  const eight=page.locator('.tour-panel[data-tour-step="analysis-open"]');await eight.waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-tour="knowledge-profile"]')?.inert);
  assert.ok(page.url().includes('#home'));await eight.locator('footer button').last().click();
  const nine=page.locator('.tour-panel[data-tour-step="analysis-report"]');await nine.waitFor();
  await page.locator('.home-weak-topic>a').first().click();await page.locator('.tour-panel[data-tour-step="replay"]').waitFor();
  assert.ok(page.url().includes('#textbook'));await page.locator('.tour-panel footer button').last().click();
  await page.locator('.tour-panel[data-tour-step="done"]').waitFor();
  report.tours.push({language,readonlyEight:true,homeTarget:true,topicNavigationAdvances:true,passed:true});await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure=error.stack;if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw error;}
finally{fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
