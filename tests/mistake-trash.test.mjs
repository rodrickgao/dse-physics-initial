import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../server/api.mjs';
import { questions } from '../server/catalog.mjs';

test('trash restores, deletes, isolates accounts, retains admin history and survives restart', async()=>{
  const directory=mkdtempSync(join(tmpdir(),'dse-trash-'));
  let api=createApi({directory,adminKey:'trash-test'});
  const server=createServer((req,res)=>api.handler(req,res,()=>{res.statusCode=404;res.end();}));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/api/`;
  function client(){let cookie='';return async(path,body,method='POST')=>{const r=await fetch(base+path,{headers:{cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{method,body:JSON.stringify(body)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,...await r.json()};};}
  async function register(c,email){const otp=await c('auth/code',{email});const login=await c('auth/verify',{email,code:otp.developmentCode});await c('profile',{nickname:'测试学生',grade:'中五',target:'5',avatar:'newton-wave',password:'Study-pass-123',confirmPassword:'Study-pass-123'},'PUT');return login.user.id;}
  try {
    const a=client(),b=client(),admin=client();const id=await register(a,'trash@example.com');await register(b,'other@example.com');
    const [key,other]=[...questions.keys()];
    await a('mistakes',{key,marked:true},'PUT');await a('mistakes',{key,marked:false},'PUT');
    assert.equal(Object.keys((await a('mistakes')).mistakes).length,0);
    assert.equal((await a('mistakes/trash')).trash[0].key,key);
    assert.equal((await b('mistakes/trash')).trash.length,0);
    assert.equal((await b('mistakes/trash',{action:'restore',keys:[key]})).status,404);
    assert.equal((await a('mistakes/trash',{action:'restore',keys:[key,other]})).status,404);
    assert.equal((await a('mistakes/trash')).trash.length,1,'failed batch must roll back');
    assert.ok((await a('mistakes/trash',{action:'restore',keys:[key]})).mistakes[key]);
    assert.equal((await a('mistakes/trash')).trash.length,0);
    assert.equal((await a('mistakes/trash',{action:'delete',keys:[key]})).status,409,'cannot permanently delete active mistakes');
    await a('mistakes',{key,marked:false},'PUT');
    await a('mistakes/trash',{action:'delete',keys:[key]});
    assert.equal((await a('mistakes/trash')).trash.length,0);
    assert.equal((await a('mistakes/trash',{action:'restore',keys:[key]})).status,409);
    await admin('admin/login',{key:'trash-test'});
    const detail=await admin(`admin/student?id=${id}`);
    assert.equal(detail.mistakes[0].status,'deleted');assert.ok(detail.mistakes[0].deletedAt);
    assert.equal((await admin('admin/overview')).students.find(s=>s.id===id).mistakes,1);
    api.close();api=createApi({directory,adminKey:'trash-test'});
    assert.equal((await a('mistakes/trash')).trash.length,0);
    assert.equal((await admin(`admin/student?id=${id}`)).mistakes[0].status,'deleted');
    await a('mistakes',{key,marked:true},'PUT');
    assert.equal((await admin(`admin/student?id=${id}`)).mistakes[0].status,'active');
    assert.ok((await admin('admin/activity?action=delete')).rows.some(r=>r.user_id===id));
  }finally{await new Promise(r=>server.close(r));api.close();rmSync(directory,{recursive:true});}
});
