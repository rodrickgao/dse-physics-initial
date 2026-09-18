import sharp from 'sharp';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApi } from '../server/api.mjs';

test('manual payment approval is isolated, persistent and grants membership exactly once', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dse-payments-'));
  let api = createApi({directory, adminKey:'payment-test'});
  const server = createServer((req,res) => api.handler(req,res,() => {res.statusCode=404;res.end();}));
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  function client() { let cookie=''; return async(path,body,method='POST') => {const r=await fetch(base+path,{headers:{cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{method,body:JSON.stringify(body)}:{})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r.headers.get('content-type')?.startsWith('image/') ? {status:r.status,image:Buffer.from(await r.arrayBuffer())} : {status:r.status,...await r.json()};}; }
  async function register(c,email) {const otp=await c('auth/code',{email});await c('auth/verify',{email,code:otp.developmentCode});await c('profile',{nickname:'测试学生',grade:'中五',target:'5',avatar:'newton-wave',password:'Study-pass-123',confirmPassword:'Study-pass-123'},'PUT');}
  try {
    const a=client(), b=client(), admin=client();
    assert.equal((await a('orders')).status,401);
    await register(a,'pay@example.com'); await register(b,'other@example.com');
    await admin('admin/login',{key:'payment-test'});
    assert.equal((await a('admin/orders')).status,403);
    const receipt='data:image/png;base64,'+(await sharp({create:{width:100,height:200,channels:3,background:'#ffffff'}}).png().toBuffer()).toString('base64');
    assert.equal((await a('orders',{requestId:randomUUID()})).status,400);
    assert.equal((await a('orders',{requestId:randomUUID(),receipt:'data:image/png;base64,YWJj'})).status,400);
    const results=await Promise.all([a('orders',{receipt,requestId:randomUUID(),amount_fen:1,days:9999}),a('orders',{receipt,requestId:randomUUID()})]);
    const order=results[0].order;
    assert.equal(order.id,results[1].order.id); assert.equal(order.amount_fen,5900);assert.equal(order.days,30);
    assert.equal((await b('orders')).order,null);
    assert.equal((await b('admin/orders/receipt?id='+order.id)).status,403);
    assert.equal((await admin('admin/orders')).pending[0].hasReceipt,1);
    assert.equal((await a('membership')).membership.active,true); assert.equal((await a('membership')).membership.revision,1);
    assert.equal((await a('admin/orders/review',{orderId:order.id,action:'approve'})).status,403);
    api.close(); api=createApi({directory,adminKey:'payment-test'});
    assert.equal((await admin('admin/orders')).pending.length,1);
    const saved=await admin('admin/orders/receipt?id='+order.id); assert.equal(saved.status,200); assert.equal((await sharp(saved.image).metadata()).format,'webp');
    const reviews=await Promise.all([admin('admin/orders/review',{orderId:order.id,action:'approve'}),admin('admin/orders/review',{orderId:order.id,action:'approve'})]);
    assert.ok(reviews.every(r=>r.status===200));
    const membership=(await a('membership')).membership;
    assert.equal(membership.active,true);assert.equal(membership.revision,1);
    assert.ok(Math.abs(membership.endsAt-Date.now()-30*86400000)<5000);
    assert.equal((await a('orders')).order.status,'approved');
    const next=(await a('orders',{receipt,requestId:randomUUID()})).order;
    await admin('admin/orders/review',{orderId:next.id,action:'approve'});
    assert.equal((await a('membership')).membership.endsAt,membership.endsAt+30*86400000);
    const rejected=(await a('orders',{receipt,requestId:randomUUID()})).order;
    assert.equal((await admin('admin/orders/review',{orderId:rejected.id,action:'reject'})).status,400);
    assert.equal((await a('membership')).membership.active,true);
    await admin('admin/orders/review',{orderId:rejected.id,action:'reject',reason:'截图金额不符'});
    await admin('admin/orders/review',{orderId:rejected.id,action:'reject',reason:'截图金额不符'});
    assert.equal((await a('membership')).membership.active,false);
    assert.equal((await a('premium/network')).status,403);
    assert.equal((await a('orders')).order.rejection_reason,'截图金额不符');
    assert.equal((await admin('admin/orders/review',{orderId:rejected.id,action:'approve'})).status,409);
    assert.equal((await a('membership')).membership.revision,4);
    assert.equal((await admin('admin/membership-history')).rows.length,4);
    api.close();api=createApi({directory,adminKey:'payment-test'});
    assert.equal((await admin('admin/orders')).recent.length,3); assert.equal((await a('membership')).membership.active,false);
  } finally { await new Promise(r=>server.close(r));api.close();rmSync(directory,{recursive:true}); }
});


