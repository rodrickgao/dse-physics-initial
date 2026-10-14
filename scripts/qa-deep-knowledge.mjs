import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture,output} from './deep-test-fixture.mjs';
import {publicTextbook} from '../server/content.mjs';
import {sharedFigureCards} from '../src/lib/shared-figure-cards.js';
import {numberKnowledgePoints} from '../src/lib/knowledge-numbering.js';
const f=await fixture('knowledge'),client=f.client(),user=await f.register(client,'all-knowledge@local.test');f.db.prepare('INSERT INTO memberships VALUES(?,?,0,1)').run(user.id,f.clock()+30*86400000);
const browser=await chromium.launch({channel:'chrome',headless:true}),report={views:[],failures:[],errors:[],cards:0};
try {
 for(const language of ['chn','eng']){
  const context=await browser.newContext({reducedMotion:'reduce'});await context.addCookies([{name:'dse_session',value:client.jar.get('dse_session'),url:f.base,httpOnly:true,sameSite:'Strict'}]);await context.addInitScript(({id,language})=>{localStorage.setItem('dse-physics-language-v1',language);localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id),JSON.stringify({version:4,status:'skipped'}));},{id:user.id,language});const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push(e.message));
  const points=numberKnowledgePoints(publicTextbook.languages[language]),chapters=[...new Set(points.map(p=>p.code))];report.cards+=sharedFigureCards(points).length;
  for(const width of [1440,834,390]){await page.setViewportSize({width,height:1000});for(const code of chapters){
   f.advance(61000);const selected=points.filter(p=>p.code===code),expected=sharedFigureCards(selected);try{
    await page.goto(f.base+'#textbook?knowledge='+selected[0].sequence);await page.locator('[data-study-knowledge-card]').first().waitFor();await page.waitForFunction(code=>[...document.querySelectorAll('.knowledge-point-head strong')].every(n=>n.textContent.split(' · ').includes(code)),code);
    assert.equal(await page.locator('[data-study-knowledge-card]').count(),expected.length,code+' card count');
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.knowledge-card-list img')].map(async img=>{try{img.loading='eager';await img.decode();}catch{}}));});
    const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+2,broken:[...document.querySelectorAll('.knowledge-card-list img')].filter(img=>!img.naturalWidth).map(img=>img.src)}));assert.equal(result.overflow,false,code+' overflow');assert.deepEqual(result.broken,[],code+' broken images');
    report.views.push({language,width,code,cards:expected.length,passed:true});
   }catch(error){report.failures.push({language,width,code,error:error.message});console.log('FAIL '+language+'/'+width+'/'+code+' '+error.message);if(report.failures.length<=6)await page.screenshot({path:path.join(output,'knowledge-failure-'+report.failures.length+'.png')});}
  }console.log('Knowledge checked '+language+' width '+width);}
  await context.close();
 }
 report.passed=report.failures.length===0&&report.errors.length===0;console.log(JSON.stringify({views:report.views.length,cards:report.cards,failures:report.failures,errors:report.errors,passed:report.passed}));
}finally{fs.writeFileSync(path.join(output,'all-knowledge-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
