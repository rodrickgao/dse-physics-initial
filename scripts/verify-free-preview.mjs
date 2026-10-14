import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const output=path.resolve('../output/free-site-20261014'),base='http://127.0.0.1:5178/';
const checks=[];
for(const page of ['index.html','admin.html']){
 const r=await fetch(base+(page==='index.html'?'':page));assert.equal(r.status,200);const html=await r.text();assert.equal(html,fs.readFileSync(path.resolve('dist',page),'utf8'));checks.push({path:page,status:200,matchingBuild:true});
 const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(m=>m[1]);
 for(const file of new Set(assets)){
  const r=await fetch(base+file.slice(1)),bytes=Buffer.from(await r.arrayBuffer());assert.equal(r.status,200);assert.deepEqual(bytes,fs.readFileSync(path.resolve('dist','.'+file)));checks.push({path:file,status:200,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }
}
const session=await(await fetch(base+'api/auth/session')).json();assert.equal(session.mailMode,'local');
for(const file of ['output/free-site-20261014/membership-history.json','server/api.mjs','text-papers/2025-eng.json'])assert.equal((await fetch(base+file)).status,404);
fs.writeFileSync(path.join(output,'preview-verification.json'),JSON.stringify({base,checks,mailMode:session.mailMode,passed:true},null,2));console.log(JSON.stringify({checks:checks.length,mailMode:session.mailMode,passed:true}));
