import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createPaymentNotifications} from '../server/payment-notifications.mjs';

test('payment mail queue retries after failure and restart without duplicating successful orders',async()=>{
 const db=new DatabaseSync(':memory:');let now=100000,attempts=0;
 const delivered=[];
 const sendMail=async message=>{attempts++;if(attempts===1)throw new Error('SMTP unavailable');delivered.push(message);};
 let queue=createPaymentNotifications({db,clock:()=>now,sendMail});
 const order={id:'order-1',amount_fen:5900,payment_method:'wechat',days:30,granted_at:now};
 try {
  queue.enqueue(order,{nickname:'测试学生',email:'test@example.com'},now+30*86400000);
  queue.enqueue(order,{nickname:'测试学生',email:'test@example.com'},now+30*86400000);
  await queue.flush();assert.equal(attempts,1);assert.equal(delivered.length,0);
  await queue.flush();assert.equal(attempts,1);
  queue.close();now+=60000;queue=createPaymentNotifications({db,clock:()=>now,sendMail});
  await Promise.all([queue.flush(),queue.flush()]);
  assert.equal(delivered.length,1);assert.equal(delivered[0].to,'rodrickgao@gmail.com');
  assert.match(delivered[0].text,/¥59.00/);assert.match(delivered[0].text,/微信支付/);assert.match(delivered[0].text,/待核对实际收款/);
  queue.close();queue=createPaymentNotifications({db,clock:()=>now,sendMail});
  await queue.flush();assert.equal(delivered.length,1);
 }finally{queue.close();db.close();}
});

test('local preview queues notifications without sending mail',async()=>{
 const db=new DatabaseSync(':memory:');const queue=createPaymentNotifications({db,clock:()=>100000});
 try {
  queue.enqueue({id:'local',amount_fen:5900,days:30,granted_at:100000},{email:'local@test.invalid'},200000);
  await queue.flush();
  assert.equal(db.prepare('SELECT sent_at FROM payment_notifications').get().sent_at,null);
 }finally{queue.close();db.close();}
});
