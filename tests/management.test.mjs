import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../server/api.mjs';
import { protectStudyFiles } from '../server/premium.mjs';
import { questions } from '../server/catalog.mjs';

test('separate admin sessions, membership lifecycle, concurrent edits, private content and activity persistence', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dse-management-'));
  let now = Date.now();
  let service = createApi({membershipEnabled:true, directory, adminKey: 'test-key', clock: () => now });
  const server = createServer((req,res) => service.handler(req,res,() => { if (!service.protectFiles(req,res)) { res.statusCode=200; res.end('Static resource'); } }));
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const jar = new Map();
  async function call(path, body, method = 'POST', cookies = jar) {
    const response = await fetch(base + path, { headers: { cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; '), ...(body ? {'Content-Type':'application/json'} : {}) }, ...(body ? {method,body:JSON.stringify(body)} : {}) });
    const set = response.headers.get('set-cookie'); if(set) { const [k,v] = set.split(';')[0].split('='); cookies.set(k,v); }
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return {status:response.status,data};
  }
  try {
    const anon = new Map();
    assert.equal((await call('/api/admin/overview',null,'GET',anon)).status,401);
    const otp = await call('/api/auth/code',{email:'member@example.com'});
    const login = await call('/api/auth/verify',{email:'member@example.com',code:otp.data.developmentCode});
    const id = login.data.user.id;
    await call('/api/profile',{nickname:'會員測試',grade:'中五',target:'5',avatar:'newton-wave',password:'Study-pass-123',confirmPassword:'Study-pass-123'},'PUT');
    assert.equal((await call('/api/admin/membership',{userId:id,action:'extend'})).status,403);
    assert.equal((await call('/api/premium/network')).status,403);
    assert.equal((await call('/assets/textbook/pdfs/chn/101.pdf',null,'GET',anon)).status,404);
    assert.equal((await call('/assets/textbook/pdfs/chn/101.pdf')).status,404);
    assert.equal((await call('/assets/textbook/pdfs/eng/101.pdf?download=1')).status,404);
    assert.equal((await call('/downloads/chn/knowledge.pdf')).status,404);
    assert.equal((await call('/api/tutoring')).status,403);
    const free=await call('/api/content/question?id=2025%7Cpaper-1a%7C1');assert.equal(free.data.reasoning,undefined);assert.ok(free.data.question&&free.data.official);
    assert.equal((await call('/knowledge-network-data.js')).data,'window.DSE_KNOWLEDGE_NETWORK={};');
    assert.equal((await call('/dist/text-papers/2025-chn.json')).status,404);
    assert.equal((await call('/@fs/anything/text-papers/2025-chn.json')).status,404);
    const q = [...questions.keys()][0];
    const event = {eventId:crypto.randomUUID(),action:'question_view',target:q,userId:999};
    await call('/api/activity',event); await call('/api/activity',event);
    assert.equal((await call('/api/activity',{...event,eventId:crypto.randomUUID(),action:'admin_grant'})).status,400);
    await call('/api/mistakes',{key:q,marked:true},'PUT');
    const studentCookie = jar.get('dse_session');
    await call('/api/admin/login',{key:'test-key'});
    assert.ok(jar.get('dse_admin_session')); assert.equal(jar.get('dse_session'),studentCookie);
    assert.equal((await call('/api/auth/session')).data.user.id,id);
    const grant = {userId:id,action:'extend',days:30,reason:'測試訂單',revision:0,requestId:crypto.randomUUID()};
    const granted = await call('/api/admin/membership',grant);
    assert.equal(granted.status,200); assert.equal(granted.data.membership.endsAt,now+30*86400000);
    const duplicate = await call('/api/admin/membership',grant); assert.equal(duplicate.data.duplicate,true);
    assert.equal((await call('/api/premium/network')).status,410);
    assert.equal((await call('/assets/textbook/pdfs/chn/101.pdf')).status,404);
    assert.equal((await call('/assets/textbook/pdfs/eng/101.pdf')).status,404);
    assert.equal((await call('/assets/textbook/pdfs/eng/all.pdf')).status,404);
    assert.equal((await call('/downloads/eng/knowledge.pdf')).status,404);
    assert.equal((await call('/@fs/anything/assets/textbook/pdfs/eng/101.pdf')).status,404);
    assert.equal((await call('/api/tutoring',{kind:'knowledge',reference:'384',message:'Explain the hierarchy.'})).status,200);
    assert.ok((await call('/api/content/question?id=2025%7Cpaper-1a%7C1')).data.reasoning);
    const attempts = await Promise.all([1,2].map(() => call('/api/admin/membership',{...grant,revision:1,requestId:crypto.randomUUID()})));
    assert.deepEqual(attempts.map(x => x.status).sort(),[200,409]);
    const member = (await call('/api/membership')).data.membership;
    assert.equal(member.endsAt,now+60*86400000);
    const activity = (await call('/api/admin/activity?action=question_view')).data;
    assert.equal(activity.total,1); assert.equal(activity.rows[0].user_id,id);
    const count = (await call('/api/admin/activity')).data.total;
    service.close(); service = createApi({membershipEnabled:true,directory,adminKey:'test-key',clock:()=>now});
    assert.equal((await call('/api/admin/activity')).data.total,count);
    assert.equal((await call('/api/membership')).data.membership.active,true);
    await call('/api/admin/membership',{...grant,action:'revoke',revision:2,requestId:crypto.randomUUID()});
    assert.equal((await call('/assets/textbook/pdfs/chn/101.pdf')).status,404);
    assert.equal((await call('/api/tutoring')).status,403);
    assert.equal((await call('/api/premium/network')).status,403);
    assert.equal((await call('/api/content/question?id=2025%7Cpaper-1a%7C1')).data.reasoning,undefined);
    await call('/api/admin/membership',{...grant,days:1,revision:3,requestId:crypto.randomUUID()});
    now += 86400001;
    assert.equal((await call('/api/membership')).data.membership.status,'expired');
    assert.equal((await call('/assets/textbook/pdfs/eng/101.pdf')).status,404);
    assert.equal((await call('/api/tutoring',{kind:'general',message:'Expired question'})).status,403);
    assert.equal((await call('/api/premium/network')).status,403);
    // Admin session expires earlier, while the student remains signed in.
    assert.equal((await call('/api/admin/overview')).status,403);
    await call('/api/admin/login',{key:'test-key'});
    assert.equal((await call('/api/admin/membership-history')).data.rows.length,4);
    await call('/api/admin/logout',{});
    assert.equal((await call('/api/auth/session')).data.user.id,id);
    assert.equal((await call('/api/admin/overview')).status,403);
  } finally { await new Promise(resolve => server.close(resolve)); service.close(); rmSync(directory,{recursive:true}); }
});
