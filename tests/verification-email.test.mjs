import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { verificationEmail } from '../server/verification-email.mjs';

test('verification mail preserves the configured sender and embeds a logo with a plain-text alternative',async()=>{
  const mail=verificationEmail({from:'Teacher <teacher@example.invalid>',to:'student@example.invalid',code:'012345'});
  assert.equal(mail.from,'Teacher <teacher@example.invalid>');
  assert.match(mail.text,/012345/);assert.match(mail.html,/012345/);
  assert.match(mail.text,/10 分钟/);assert.match(mail.html,/ddphysics\.com/);
  assert.match(mail.html,/src="cid:dse-physics-brand@ddphysics\.com"/);
  assert.equal(mail.attachments[0].content.subarray(1,4).toString(),'PNG');
  const transport=nodemailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
  const {message}=await transport.sendMail(mail); // Build MIME locally; no network transport.
  const mime=message.toString();
  assert.match(mime,/multipart\/alternative/);assert.match(mime,/multipart\/related/);
  assert.match(mime,/Content-ID: <dse-physics-brand@ddphysics.com>/);
  assert.match(mime,/Content-Type: text\/plain/);assert.match(mime,/Content-Type: text\/html/);
});

test('only six digits can enter the email template',()=>{
  for(const code of ['12345','1234567','<img>1','123456\n']) assert.throws(()=>verificationEmail({code}));
});
