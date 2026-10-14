import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture} from './deep-test-fixture.mjs';
import {topicsInBookOrder} from '../src/lib/topic-display-order.js';
import {questions,pointInfo} from '../server/catalog.mjs';
import {isTrialPractice} from '../server/recommendation-access.mjs';

const output=path.resolve(process.env.DSE_QA_OUTPUT || '../output/topic-book-order-20261013');fs.mkdirSync(output,{recursive:true});
const f=await fixture('topic-practice'),browser=await chromium.launch({channel:'chrome',headless:true});
const report={views:[],flows:[],tours:[],errors:[]},users={};
let lastPage,lastView;
const examples=[...questions.values()].filter(q=>q.source==='examples').map(q=>q.key);
const guide=async(client,language='chn')=>{const r=await client.call('learning/dashboard?language='+language);assert.equal(r.status,200);return r.data;};
async function contextFor(record,language,width=1440,skip=true) {
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
 for(const [name,value]of record.client.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
 await context.addInitScript(({id,language,skip})=>{try{localStorage.setItem('dse-physics-language-v1',language);if(skip)localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped'}));}catch{}},{id:record.user.id,language,skip});
 context.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));
 return context;
}
async function checkRows(page,expected,member,expanded) {
 const rows=topicsInBookOrder(expanded?expected.weak_points:expected.weak_points.slice(0,3));
 const list=page.locator('[data-review-topic]');await list.first().waitFor();
 await page.waitForFunction(n=>document.querySelectorAll('[data-review-topic]').length===n,rows.length);
 assert.deepEqual(await list.evaluateAll(nodes=>nodes.map(n=>n.dataset.reviewTopic)),rows.map(p=>p.knowledge_id));
 const bookPosition=point=>{const match=point.number.match(/^(E?)(\d+)[.]([\dAB]+)[.](\d+)$/);assert.ok(match,point.number);return [(match[1]?5:0)+Number(match[2]),match[3],Number(match[4])];};
 const expectedBookOrder=[...rows].sort((a,b)=>{const x=bookPosition(a),y=bookPosition(b);return x[0]-y[0]||x[1].localeCompare(y[1],'en',{numeric:true})||x[2]-y[2];});
 assert.deepEqual(rows.map(p=>p.number),expectedBookOrder.map(p=>p.number));
 if(expected.weak_points.length>3){
  const bottom=await page.locator('.student-topic-disclosure>button').evaluate(node=>({y:node.getBoundingClientRect().top,last:node.closest('.student-topic-guidance').querySelector('.student-topic-list').getBoundingClientRect().bottom,expanded:node.getAttribute('aria-expanded'),controls:!!document.getElementById(node.getAttribute('aria-controls'))}));
  assert.ok(bottom.y>=bottom.last&&bottom.controls);assert.equal(bottom.expanded,String(expanded));
 }
 for(let i=0;i<rows.length;i++){
  const row=rows[i],node=list.nth(i),items=member?row.practice.items:row.practice.items.filter(q=>q.trialAvailable);
  assert.deepEqual(await node.locator('[data-topic-practice]').evaluateAll(nodes=>nodes.map(n=>n.dataset.topicPractice)),items.map(q=>q.question_id));
  for(const q of items){assert.ok(q.question_id.startsWith('tb-'));assert.ok(questions.get(q.question_id).points.some(id=>pointInfo(id).number===row.number));assert.ok(member||isTrialPractice(q.question_id));}
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
}
try {
 for(const state of ['member','free','expired','revoked','empty']) {
  f.advance(61000);const client=f.client(),user=await f.register(client,'topic-'+state+'@local.test');users[state]={client,user};
  if(state!=='empty')assert.equal((await client.call('mistakes/import',{keys:examples})).status,200);
  if(state==='member'||state==='expired'||state==='revoked')f.db.prepare('INSERT INTO memberships VALUES(?,?,?,1)').run(user.id,state==='expired'?f.clock()-1:f.clock()+30*86400000,state==='revoked'?1:0);
 }
 for(const state of ['member','free','expired','revoked'])for(const language of ['chn','eng'])for(const width of (['member','free'].includes(state)?[1440,1024,390,320]:[390])) {
  if(process.env.DSE_TOPIC_QA_VIEW&&process.env.DSE_TOPIC_QA_VIEW!==`${state}-${language}-${width}`)continue;
  f.advance(61000);const record=users[state],member=state==='member',expected=await guide(record.client,language);
  assert.ok(expected.weak_points.length>20,'all topics must survive the old dashboard page limit');
  const context=await contextFor(record,language,width),page=await context.newPage();
  lastPage=page;lastView={state,language,width};
  await page.goto(f.base+'#mistakes');await page.locator('.student-topic-guidance').waitFor();await checkRows(page,expected,member,false);
  assert.equal(await page.locator('.qdna-recommendation-disclosure').count(),0);
  const summary=page.locator('.student-topic-disclosure>button');
  await summary.focus();await page.keyboard.press('Enter');await page.locator('.student-topic-disclosure>button[aria-expanded="true"]').waitFor();await checkRows(page,expected,member,true);
  if(width===1440||width===320){await summary.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`expanded-bottom-${state}-${language}-${width}.png`)});}
  await summary.click();await page.locator('.student-topic-disclosure>button[aria-expanded="true"]').waitFor({state:'hidden'});await checkRows(page,expected,member,false);
  if(width===1440||width===320)await page.locator('.student-learning-guide').screenshot({path:path.join(output,`${state}-${language}-${width}.png`)});
  await page.goto(f.base+'#home');await page.locator('.student-weak-points a').first().waitFor();
  assert.deepEqual(await page.locator('.student-weak-points a').evaluateAll(nodes=>nodes.map(node=>new URLSearchParams(node.hash.split('?')[1]).get('knowledge'))),topicsInBookOrder(expected.weak_points.slice(0,3)).map(p=>p.knowledge_id));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  if(width===1440||width===320)await page.locator('.student-learning-guide').screenshot({path:path.join(output,`home-${state}-${language}-${width}.png`)});
  report.views.push({state,language,width,topics:expected.weak_points.length,defaultTopics:3,expandedAll:true,matchingExercises:true,bookOrder:true,collapseAtBottom:true,homeOrder:true,passed:true});
  console.log('PASS '+state+' '+language+' '+width);
  await context.close();
 }
 // Real exercise navigation and mastery, not just a seeded mastered record.
 for(const language of ['chn','eng']) {
  f.advance(61000);const record=users.member,context=await contextFor(record,language,language==='chn'?1440:390),page=await context.newPage();
  const before=await guide(record.client,language),picked=before.weak_points[0].practice.items[0];assert.ok(picked);
  await page.goto(f.base+'#mistakes');await page.locator(`[data-topic-practice="${picked.question_id}"]`).click();
  await page.locator(`[data-exercise="${picked.question_id}"]`).waitFor();assert.ok(page.url().includes('exercises'));
  await page.locator('[data-mark-kind="mastered"]').first().click();await page.waitForFunction(()=>document.querySelector('[data-mark-kind="mastered"]')?.getAttribute('aria-pressed')==='true');
  const after=await guide(record.client,language);assert.ok(after.weak_points.every(p=>p.practice.items.every(q=>q.question_id!==picked.question_id)));
  await page.goto(f.base+'#mistakes');await page.locator('.student-topic-guidance').waitFor();await page.locator('.student-topic-disclosure>button').click();await checkRows(page,after,true,true);
  const link=page.locator('.student-topic-title').first(),topic=topicsInBookOrder(after.weak_points)[0];await link.click();await page.waitForFunction(id=>[...document.querySelectorAll('[data-knowledge-sequences]')].some(n=>n.dataset.knowledgeSequences.split(',').includes(id)),topic.knowledge_id);
  report.flows.push({language,realMasteryExclusion:true,question:picked.question_id,knowledgeNavigation:true,passed:true});
  await record.client.call('progress',{keys:[picked.question_id],status:'clear'},'PUT');await context.close();
 }
 // Empty, sparse and failed fetch/retry states.
 for(const language of ['chn','eng']) {
  f.advance(61000);const record=users.empty,context=await contextFor(record,language,390),page=await context.newPage();
  await page.goto(f.base+'#mistakes');await page.locator('.student-learning-guide .qdna-note').waitFor();assert.equal(await page.locator('[data-review-topic]').count(),0);
  await record.client.call('mistakes/import',{keys:['ex-101-1']});await page.reload();const expected=await guide(record.client,language);await checkRows(page,expected,false,false);assert.equal(expected.weak_points.length,1);assert.equal(await page.locator('.student-topic-disclosure').count(),0);
  let failed=true;await context.route('**/api/learning/dashboard?**',r=>failed?r.fulfill({status:503,json:{error:'Isolated retry test'}}):r.continue());
  await page.reload();await page.locator('.student-learning-guide [role="alert"]').waitFor();failed=false;await page.locator('.student-learning-guide [role="alert"] button').click();await checkRows(page,expected,false,false);await context.unroute('**/api/learning/dashboard?**');
  report.flows.push({language,empty:true,sparse:true,retry:true,passed:true});
  await record.client.call('progress',{keys:['ex-101-1'],status:'clear'},'PUT');await context.close();
 }
 // Losing membership removes paid practice from an already open page.
 {
  f.advance(61000);const record=users.member,context=await contextFor(record,'chn'),page=await context.newPage();
  await page.goto(f.base+'#mistakes');await page.locator('.student-topic-guidance').waitFor();
  f.db.prepare('UPDATE memberships SET revoked=1,revision=revision+1 WHERE user_id=?').run(record.user.id);await page.evaluate(()=>dispatchEvent(new Event('focus')));
  await page.locator('.membership-status').filter({hasText:'会员已暂停'}).waitFor();
  const expected=await guide(record.client);await page.locator('.student-topic-guidance').waitFor();await page.locator('.student-topic-disclosure>button').click();await checkRows(page,expected,false,true);
  f.db.prepare('UPDATE memberships SET revoked=0,revision=revision+1 WHERE user_id=?').run(record.user.id);await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.locator('.membership-status').filter({hasText:'会员至'}).waitFor();
  await page.locator('.student-topic-guidance').waitFor();await checkRows(page,await guide(record.client),true,false);
  report.flows.push({membershipRevokeAndRenewal:true,passed:true});await context.close();
 }
 // The new automatic topic list replaces the old "expand recommendations" action.
 for(const language of ['chn','eng']) {
  f.advance(61000);const client=f.client(),user=await f.register(client,'topic-tour-'+language+'@local.test'),record={client,user};
  const context=await contextFor(record,language,language==='chn'?1440:390,false),page=await context.newPage();
  await page.goto(f.base);const panel=page.locator('.tour-panel');
  await page.locator('.tour-panel[data-tour-step="welcome"]').waitFor();await panel.getByRole('button',{name:language==='chn'?'开始体验':'Start exploring',exact:true}).click();
  for(const [step,target]of [['open','example-chapter-101'],['solution','example-solution'],['mastered','mark-mastered'],['mark','mark-mistake'],['mistake-review','tour-mistake-open'],['question-knowledge','question-knowledge'],['knowledge-question','knowledge-question-2']]){
   await page.locator(`.tour-panel[data-tour-step="${step}"]`).waitFor();await page.locator(`[data-tour="${target}"]`).filter({visible:true}).first().click();
  }
  for(const step of ['analysis-open','analysis-report','replay']){const p=page.locator(`.tour-panel[data-tour-step="${step}"]`);await p.waitFor();if(step==='analysis-open'){assert.equal(await page.locator('[data-review-topic]').count(),1);assert.ok(await page.locator('[data-topic-practice]').count());}await p.locator('footer button').last().click();}
  await page.locator('.tour-panel[data-tour-step="done"]').waitFor();const saved=await page.evaluate(id=>JSON.parse(localStorage.getItem('ddphysics-tour:v4:'+encodeURIComponent(id))),user.id);assert.equal(saved.status,'completed');assert.deepEqual(saved.skippedSteps,[]);
  report.tours.push({language,steps:10,passed:true});await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
} catch(error) {report.failure=error.stack;report.lastView=lastView;if(lastPage&&!lastPage.isClosed()){await lastPage.screenshot({path:path.join(output,'failure.png')});report.overflow=await lastPage.evaluate(()=>[...document.querySelectorAll('body *')].map(n=>({tag:n.tagName,cls:n.className,b:n.getBoundingClientRect(),text:n.textContent.slice(0,80)})).filter(n=>n.b.right>innerWidth+2||n.b.left<0).map(n=>({...n,b:{left:n.b.left,right:n.b.right,width:n.b.width}})).slice(0,30));}throw error;}
finally {
 fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();
 if(!path.resolve(f.directory).startsWith(path.resolve(tmpdir())+path.sep)||!path.basename(f.directory).startsWith('ddphysics-deep-topic-practice-'))throw Error('Unexpected fixture directory');
 fs.rmSync(f.directory,{recursive:true});
}
console.log(JSON.stringify({views:report.views.length,flows:report.flows.length,tours:report.tours.length,errors:report.errors,passed:report.passed}));
