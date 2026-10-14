import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture,output} from './deep-test-fixture.mjs';
import {adminPageLabel,adminPageHref,pages} from '../src/lib/admin-labels.js';

const f=await fixture('visits'),browser=await chromium.launch({channel:'chrome',headless:true});
const report={records:0,checks:[],errors:[],passed:false};
const students=[];
try {
 for(let i=0;i<2;i++){const client=f.client(),user=await f.register(client,`visits-${i}@local.test`,`访问学生 ${i}`);students.push({client,user});}
 const targets=Object.keys(pages).map(page=>page==='examples'?'examples?question=ex-101-1':page==='textbook'?'textbook?knowledge=1':page);
 let expectedDuration=0;
 for(let i=0;i<68;i++){
  const student=students[i%2],durationMs=i<64?61000+i:i===64?59999:i===65?60000:i===66?60001:90000;
  const body={visitId:crypto.randomUUID(),target:targets[i%targets.length],durationMs:0};
  assert.equal((await student.client.call('page-visits',body)).status,200);
  f.advance(durationMs);body.durationMs=durationMs;
  assert.equal((await student.client.call('page-visits',body)).status,200);
  assert.equal((await student.client.call('page-visits',body)).status,200,'duplicate is idempotent');
  assert.equal((await student.client.call('page-visits',{...body,durationMs:0})).status,200,'stale heartbeat preserves newer total');
  expectedDuration+=durationMs;
 }
 const admin=f.client();await admin.call('admin/login',{key:'isolated-deep-test-key'});
 const visits=(await admin.call('admin/page-visits')).data;
 assert.equal(visits.total,66);assert.equal(visits.rows.length,50);assert.ok(visits.rows.every(r=>r.duration_ms>60000));
 assert.equal((await admin.call('admin/page-visits?page=2')).data.rows.length,16);
 assert.equal(f.db.prepare('SELECT sum(duration_ms) total FROM daily_site_usage').get().total,expectedDuration);
 report.records=68;report.checks.push('one-minute boundary, duplicate/stale heartbeats, exact aggregate duration and 50-row paging');
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 for(const [name,value]of admin.jar)await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
 context.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));
 const page=await context.newPage();
 for(const language of ['chn','eng']){
  await page.goto(f.base+'admin.html#visits');await page.evaluate(value=>localStorage.setItem('dse-physics-language-v1',value),language);await page.reload();
  const panel=page.locator('.admin-insights');await panel.locator('tbody tr').nth(49).waitFor();
  const links=await panel.locator('tbody td:nth-child(3) a').evaluateAll(nodes=>nodes.map(n=>({href:n.getAttribute('href'),text:n.textContent})));
  assert.equal(links.length,50);for(const link of links){const target=link.href.split('#')[1];assert.equal(link.href,adminPageHref(target));assert.ok(link.text.includes(adminPageLabel(target,language)),link.text);}
  const next=panel.locator('.pagination button').nth(1);await next.click();await page.waitForFunction(()=>document.querySelectorAll('.admin-insights tbody tr').length===16);
  assert.equal(await next.isDisabled(),true);await panel.locator('.pagination button').first().click();await panel.locator('tbody tr').nth(49).waitFor();
  report.checks.push('populated bilingual visit labels, preserved links and next/previous paging: '+language);
 }
 const selected=Number((await page.locator('.admin-insights tbody button').first().innerText()).match(/#(\d+)/)[1]);
 await page.locator('.admin-insights tbody button').first().click();await page.locator('.detail .admin-insights tbody tr').first().waitFor();
 const filtered=(await admin.call('admin/page-visits?userId='+selected)).data;
 assert.equal(await page.locator('.detail .admin-insights tbody tr').count(),filtered.total);assert.ok(filtered.rows.every(r=>r.user_id===selected));
 assert.match(page.url(),new RegExp('student='+selected));report.checks.push('student drill-down retains selected identity and only that student’s visits');
 const studentContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),student=students[0];
 for(const [name,value]of student.client.jar)await studentContext.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
 await studentContext.addInitScript(id=>localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped'})),student.user.id);
 const reader=await studentContext.newPage();await reader.goto(f.base+adminPageHref('examples?question=ex-101-1').slice(1));await reader.locator('[data-example="ex-101-1"][aria-busy="false"]').waitFor();
 await reader.goto(f.base+adminPageHref('support').slice(1));await reader.locator('a[href="mailto:rodrickgao@gmail.com"]').waitFor();
 report.checks.push('admin example/support links open the intended student pages');
 report.passed=report.errors.length===0;console.log(JSON.stringify(report));
}finally{fs.writeFileSync(path.join(output,'visits-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
