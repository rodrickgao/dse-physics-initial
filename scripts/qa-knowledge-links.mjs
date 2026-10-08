import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({storageState:'../tmp/exercise-qa-session.json',viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
const samples=[['examples','ex-202-2'],['examples','ex-202-4'],['examples','ex-207-9'],['exercises','tb-204-1'],['papers','2025|paper-1a|7']];
try{await p.addInitScript(()=>localStorage.setItem('dse-physics-language-v1','chn'));
 for(const [route,key] of samples){await p.goto(`http://127.0.0.1:5178/#${route}?question=${encodeURIComponent(key)}`);await p.locator('.study-flow[aria-busy=false]').waitFor();const labels=await p.locator('.related-panel button,.exercise-knowledge button').allTextContents();const nums=labels.map(s=>s.match(/E?\d+(?:\.\d+)+/)?.[0]).filter(Boolean);assert.deepEqual(nums,[...nums].sort(new Intl.Collator('en',{numeric:true}).compare));
 if(key==='ex-202-2'){assert.equal(labels.length,1);assert.match(labels[0],/2\.2\.1/);await p.screenshot({path:'../tmp/search-reader-qa/example-specific-knowledge.png',fullPage:true});}
 if(key==='ex-202-4'){assert.equal(labels.length,1);assert.match(labels[0],/2\.2\.4/);}
 }
 const alignment=await p.evaluate(()=>({nav:document.querySelector('.nav-item strong').getBoundingClientRect().left,timer:document.querySelector('.sidebar .timer-open span').getBoundingClientRect().left,icon:document.querySelector('.sidebar .timer-open svg').getBoundingClientRect().left,navIcon:document.querySelector('.nav-item svg').getBoundingClientRect().left}));assert.ok(Math.abs(alignment.nav-alignment.timer)<1);assert.ok(Math.abs(alignment.icon-alignment.navIcon)<1);
 await p.locator('.sidebar .timer-expand').click();await p.locator('.sidebar .focus-countdown').waitFor();await p.locator('.sidebar .timer-collapse').click();await p.locator('.sidebar .timer-open').waitFor();
 await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);console.log('Specific links, numeric order, timer alignment and controls passed',alignment);
}finally{await b.close();}
