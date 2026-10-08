import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {questions} from '../server/catalog.mjs';

const base='http://127.0.0.1:5178',out='../tmp/mistake-review';fs.mkdirSync(out,{recursive:true});
const keys=['2012|paper-1a|1','2012|paper-1a|8','2012|paper-1a|23','2012|paper-2|1.1','2012|paper-2|1.8','2012|paper-1b|1','tb-201-1','tb-201-12','tb-102-1'];
const initial=Object.fromEntries(keys.map((key,i)=>[key,{markedAt:new Date(1700000000000+i).toISOString(),chapterCode:questions.get(key).chapterCode,primaryChapterCode:questions.get(key).primaryChapterCode}]));
let mistakes=structuredClone(initial),mastered={};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({storageState:'../tmp/exercise-qa-session.json',viewport:{width:1600,height:1100},reducedMotion:'reduce'});
 assert.ok((await(await context.request.get(base+'/api/auth/session')).json()).user);
 assert.ok((await(await context.request.get(base+'/api/membership')).json()).membership.active);
 // Exercise all mutations in the browser without changing the user's actual study records.
 await context.route('**/api/mistakes',route=>route.fulfill({json:{mistakes,mastered}}));
 await context.route('**/api/progress',route=>{const body=route.request().postDataJSON();assert.equal(body.status,'mastered');for(const key of body.keys){delete mistakes[key];mastered[key]=new Date().toISOString();}return route.fulfill({json:{mistakes,mastered}});});
 await context.addInitScript(()=>localStorage.setItem('dse-physics-language-v1','chn'));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#mistakes');await page.waitForFunction(()=>document.querySelector('.membership-status')?.textContent.includes('会员至'));await page.locator('[data-review-point]').nth(2).waitFor();await page.waitForFunction(count=>document.querySelectorAll('[data-mistake]').length===count,keys.length);
 assert.equal(await page.locator('[data-mistake]').count(),keys.length);assert.equal(await page.locator('.mistake-analysis .analysis-card').count(),1);
 const pieCounts=(await page.locator('.chapter-pie-legend strong').allTextContents()).map(Number);assert.equal(pieCounts.reduce((a,b)=>a+b,0),keys.length);
 await page.locator('.mistake-review-card').screenshot({path:out+'/review-desktop.png'});
 await page.getByRole('button',{name:'查看详细章节统计',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
 const matrix=await dialog.locator('tbody tr').evaluateAll(rows=>rows.map(row=>[row.querySelector('th small')?.textContent,...[...row.querySelectorAll('td')].slice(0,4).map(n=>n.textContent)]));
 assert.ok(matrix.length>3);assert.equal(matrix.reduce((n,r)=>n+Number(r[1]),0),keys.length);
 for(const [code,count,percent,mc,long]of matrix){assert.equal(Number(count),keys.filter(k=>questions.get(k).primaryChapterCode===code).length);assert.equal(Number(mc)+Number(long),Number(count));assert.equal(percent,(Number(count)/keys.length*100).toFixed(1)+'%');}
 assert.doesNotMatch(await dialog.innerText(),/其他|更多/);await dialog.screenshot({path:out+'/statistics-desktop.png'});
 const firstChapterCount=Number(matrix[0][1]);await dialog.locator('tbody tr').first().getByRole('button',{name:'查看错题',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(await page.locator('[data-mistake]').count(),firstChapterCount);
 await page.getByRole('button',{name:'查看全部错题',exact:true}).click();
 const recommendation=page.locator('[data-review-point]').first(),sequence=Number(await recommendation.getAttribute('data-review-point'));
 await recommendation.getByRole('button',{name:'查看知识卡',exact:true}).click();await page.waitForFunction(sequence=>[...document.querySelectorAll('[data-knowledge-sequences]')].some(n=>n.dataset.knowledgeSequences.split(',').includes(String(sequence))),sequence);await page.goBack();await page.locator('[data-review-point]').first().waitFor();
 await page.locator(`[data-review-point="${sequence}"]`).getByRole('button',{name:'重做错题',exact:true}).click();
 const expected=keys.filter(k=>questions.get(k).points.includes(sequence));assert.equal(await page.locator('[data-mistake]').count(),expected.length);assert.match(page.url(),/mistakes\?point=/);
 await page.locator('[data-mistake]').first().getByRole('button',{name:'打开',exact:true}).click();await page.locator('#current-question').waitFor();await page.goBack();await page.locator('.mistake-review-filter').waitFor();assert.equal(await page.locator('[data-mistake]').count(),expected.length);
 const oldCount=expected.length;await page.locator('[data-mistake]').first().getByRole('button',{name:'标为已掌握',exact:true}).click();await page.waitForFunction(count=>document.querySelectorAll('[data-mistake]').length===count,oldCount-1);
 assert.equal((await page.locator('.chapter-pie-legend strong').allTextContents()).map(Number).reduce((a,b)=>a+b,0),keys.length-1);
 if(oldCount>1)assert.equal(await page.locator(`[data-review-point="${sequence}"]`).count(),1);
 await page.getByRole('button',{name:'查看全部错题',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'查看详细章节统计',exact:true}).click();await dialog.screenshot({path:out+'/statistics-mobile.png'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await dialog.evaluate(n=>n.scrollWidth<=n.clientWidth+1));
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.ok(await page.locator('.chapter-pie').evaluate(n=>n===document.activeElement));
 await page.locator('.language-switch').click();await page.getByRole('button',{name:'View detailed chapter statistics',exact:true}).click();await page.getByRole('heading',{name:'Detailed chapter statistics',exact:true}).waitFor();assert.equal(await dialog.locator('tbody tr').first().locator('td').first().getAttribute('data-label'),'Questions');
 await page.keyboard.press('Escape');
 await context.route('**/api/membership',route=>route.fulfill({json:{membership:{active:false,revision:99}}}));await page.evaluate(()=>dispatchEvent(new Event('focus')));
 await page.waitForFunction(()=>document.querySelectorAll('[data-review-point]').length===0);await page.locator('.chapter-pie').waitFor();assert.equal(await page.locator('.chapter-pie').count(),1);
 assert.equal((await page.locator('.chapter-pie-legend strong').allTextContents()).map(Number).reduce((a,b)=>a+b,0),keys.length-1);
 assert.deepEqual(errors,[]);console.log('PASS: single-count totals, complete breakdown, chapter filters, actionable recommendations, knowledge links, review/back, mastery updates, mobile, keyboard dismissal, English, membership boundaries. No saved study data changed.');
}finally{await browser.close();}
