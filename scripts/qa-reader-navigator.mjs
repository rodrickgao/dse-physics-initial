import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({storageState:'../tmp/exercise-qa-session.json',viewport:{width:1920,height:1080}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{await p.addInitScript(()=>localStorage.setItem('dse-physics-language-v1','chn'));
for(const [page,key] of [['papers','2025|paper-1a|7'],['exercises','tb-202-1'],['examples','ex-101-1']]){
 await p.goto(`http://127.0.0.1:5178/#${page}?question=${encodeURIComponent(key)}`);await p.locator('.study-flow[aria-busy=false]').waitFor();
 const toggle=p.locator('.navigator-toggle');if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
 const widths=await p.locator('.question-card').evaluate(n=>n.getBoundingClientRect().width);
 assert.equal(await p.locator('.study-content').first().evaluate(n=>getComputedStyle(n).fontSize),'22px');
 if(page==='papers'){assert.equal(await p.locator('.question-header-actions button').first().evaluate(n=>getComputedStyle(n).fontSize),'18px');await p.screenshot({path:'../tmp/search-reader-qa/reader-wide.png',fullPage:false});}
 await toggle.click();assert.equal(await p.locator('.paper-navigator').isVisible(),false);assert.ok(await p.locator('.question-card').evaluate(n=>n.getBoundingClientRect().width)>widths+200);
 await p.reload();await p.locator('.study-flow[aria-busy=false]').waitFor();assert.equal(await p.locator('.navigator-toggle').getAttribute('aria-expanded'),'false');
 if(page==='papers')await p.screenshot({path:'../tmp/search-reader-qa/reader-collapsed.png',fullPage:false});
 await p.setViewportSize({width:390,height:844});assert.equal(await toggle.isVisible(),false);await p.locator('.mobile-picker').click();assert.equal(await p.locator('.paper-navigator').isVisible(),true);await p.locator('.mobile-picker').click();assert.equal(await p.locator('.paper-navigator').isVisible(),false);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.setViewportSize({width:1920,height:1080});await toggle.click();
}
assert.deepEqual(errors,[]);console.log('Reader font sizes, collapse, persistence and mobile picker verified');}finally{await b.close();}
