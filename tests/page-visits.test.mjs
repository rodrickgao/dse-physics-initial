import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('visit tracking separates pushState routes, pauses hidden tabs and flushes on logout',async()=>{
 let now=0,tick,id=0;
 const handlers={},sent=[],location={hash:'#papers?question=2012%7Cpaper-1a%7C1'};
 const document={hidden:false,addEventListener:(n,f)=>handlers[n]=f,removeEventListener:n=>delete handlers[n]};
 const window={addEventListener:(n,f)=>handlers[n]=f,removeEventListener:n=>delete handlers[n]};
 const source=readFileSync(new URL('../src/lib/page-visits.js',import.meta.url),'utf8').replace('export function','function');
 const ctx={window,document,location,URLSearchParams,performance:{now:()=>now},crypto:{randomUUID:()=>`visit-${++id}`},fetch:async(u,o)=>{sent.push(JSON.parse(o.body));return {ok:true};},setInterval:f=>{tick=f;return 1;},clearInterval:()=>{tick=null;}};
 runInNewContext(source+';this.stop=startPageVisits();',ctx);
 const flush=()=>new Promise(r=>setImmediate(r));
 const advance=ms=>{for(let n=0;n<ms;n+=1000){now+=1000;tick();}};
 advance(70000);await flush();
 assert.equal(sent.at(-1).durationMs,70000);
 document.hidden=true;handlers.visibilitychange();advance(120000);document.hidden=false;handlers.visibilitychange();await flush();
 assert.equal(sent.at(-1).durationMs,70000);
 location.hash='#examples?question=ex-102-1';advance(1000);await flush();
 assert.equal(sent.at(-1).target,'examples?question=ex-102-1');assert.equal(sent.at(-1).durationMs,0);
 advance(10000);ctx.stop();await flush();
 assert.equal(sent.at(-1).durationMs,10000);assert.equal(tick,null);
 assert.equal(new Set(sent.map(s=>s.visitId)).size,2);
});
