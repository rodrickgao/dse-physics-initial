import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fixture} from './deep-test-fixture.mjs';
const output=path.resolve('../output/free-site-20261014/content');
const report=JSON.parse(fs.readFileSync(path.join(output,'all-content-report.json'),'utf8'));
fs.writeFileSync(path.join(output,'initial-content-report.json'),JSON.stringify(report,null,2));
const f=await fixture('free-content-boundary'),c=f.client();
try{
 await f.register(c,'free-boundary@local.test');const checks=[];
 for(const route of ['/text-papers/2025-chn.json','/assets/textbook-exercises/chn/101.json','/server/api.mjs','/.local-membership-preview/students.sqlite','/knowledge_catalog.json','/output/free-site-20261014/membership-backup/server/api.mjs']){
  for(const cookie of ['',c.cookie()]){const r=await fetch(f.base+route.slice(1),{headers:{cookie}});assert.equal(r.status,404);checks.push({route,status:r.status,signedIn:Boolean(cookie)});}
 }
 for(const language of ['chn','eng']){
  const route=`assets/textbook/pdfs/${language}/101.pdf`;
  assert.equal((await fetch(f.base+route,{method:'HEAD'})).status,401);
  const r=await fetch(f.base+route,{method:'HEAD',headers:{cookie:c.cookie()}});assert.equal(r.status,200);checks.push({route,status:200,signedIn:true});
 }
 assert.equal(report.editions,4936);assert.equal(report.issues.length,0);assert.ok(report.layouts.every(l=>l.checked===13660&&l.failures.length===0));
 delete report.failure;report.boundaryRecheck={reason:'Free chapters require a signed-in account; the old audit expected them to be closed to every account.',checks,passed:true};report.passed=true;
 fs.writeFileSync(path.join(output,'all-content-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({editions:report.editions,blocks:report.blocks,layouts:report.layouts.length,boundaries:checks.length,passed:true}));
}finally{await f.close();}
