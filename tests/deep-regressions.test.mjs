import {MEMBERSHIP_ENABLED} from '../src/lib/access-policy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {createApi} from '../server/api.mjs';
import {adminPageLabel,adminPageHref} from '../src/lib/admin-labels.js';

test('support activity is accepted and retained with a working bilingual admin link',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'dse-deep-regression-')),api=createApi({membershipEnabled:true,directory,adminKey:'isolated-regression-key'});
 const server=createServer((req,res)=>api.handler(req,res,()=>{res.writeHead(404);res.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api/`,jar=new Map();
 const call=async(path,body)=>{const response=await fetch(base+path,{headers:{cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(body?{'Content-Type':'application/json'}:{})},...(body?{method:path==='profile'?'PUT':'POST',body:JSON.stringify(body)}:{})});for(const cookie of response.headers.getSetCookie()){const [key,value]=cookie.split(';')[0].split('=');jar.set(key,value);}return {status:response.status,data:await response.json()};};
 try {
  const email='support-regression@local.test',code=await call('auth/code',{email});await call('auth/verify',{email,code:code.data.developmentCode});
  assert.equal((await call('profile',{nickname:'支持页测试',grade:'中五',target:'5',password:'Regression-test-123',confirmPassword:'Regression-test-123'})).status,200);
  const event={eventId:crypto.randomUUID(),action:'page_view',target:'support'};assert.equal((await call('activity',event)).status,200);assert.equal((await call('activity',event)).status,200);
  await call('admin/login',{key:'isolated-regression-key'});const activity=await call('admin/activity?action=page_view');assert.equal(activity.data.total,1);assert.equal(activity.data.rows[0].target,'support');
  for(const query of ['page=Infinity','page=NaN','page=-1','page=1.5','page=9007199254740992','userId=Infinity','userId=1.5'])assert.equal((await call('admin/page-visits?'+query)).status,400,query);
  for(const query of ['','?page=1','?page=0','?page=100000','?userId=0']){const response=await call('admin/page-visits'+query);assert.equal(response.status,200);assert.deepEqual(response.data.rows,[]);}
 }finally {server.closeAllConnections();await new Promise(r=>server.close(r));api.close();const target=resolve(directory);assert.equal(dirname(target),resolve(tmpdir()));assert.ok(basename(target).startsWith('dse-deep-regression-'));rmSync(target,{recursive:true});}
});

test('admin page labels and links cover every student page without losing question references',()=>{
 assert.equal(adminPageLabel('support','chn'),'技术支持');assert.equal(adminPageLabel('support','eng'),'Technical support');assert.equal(adminPageHref('support'),'/#support');
 assert.equal(adminPageLabel('examples?question=ex-101-1','chn'),'课本例题');assert.equal(adminPageLabel('examples?question=ex-101-1','eng'),'Textbook examples');assert.equal(adminPageHref('examples?question=ex-101-1'),'/#examples?question=ex-101-1');
 for(const page of ['home','bank','papers','textbook','examples','exercises','mistakes','focus','profile','ask','support'])assert.ok(adminPageHref(page),page);
 for(const page of ['membership','payment','receipt','activating','member-success']){if(MEMBERSHIP_ENABLED)assert.ok(adminPageHref(page));else{assert.equal(adminPageHref(page),null);assert.equal(adminPageLabel(page,'eng'),'Disabled page');}}
 assert.equal(adminPageHref('unknown'),null);
});
