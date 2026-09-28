import ExcelJS from 'exceljs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import sharp from 'sharp';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../server/api.mjs';
import { questions } from '../server/catalog.mjs';

async function fixture(options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'dse-auth-'));
  let now = Date.now();
  const api = createApi({ directory, adminKey: 'test-admin-key', clock: () => now, ...options });
  const server = createServer((req, res) => api.handler(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  function client() {
    let cookie = '';
    return async (path, body, method = 'POST', headers = {}) => {
      const response = await fetch(`${base}/api/${path}`, { headers: { cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { method, body: JSON.stringify(body) }) });
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      return { status: response.status, data: await response.json(), headers: response.headers };
    };
  }
  return { client, base, advance: ms => { now += ms; }, directory, async close() { await new Promise(resolve => server.close(resolve)); api.close(); rmSync(directory, { recursive: true }); } };
}
async function register(client, email) {
  const sent = await client('auth/code', { email }); assert.equal(sent.status, 200);
  const login = await client('auth/verify', { email, code: sent.data.developmentCode }); assert.equal(login.status, 200);
  const profile = await client('profile', { password: 'Study-pass-123', confirmPassword: 'Study-pass-123', nickname: 'Test student', grade: '中五', target: '5*', avatar: 'newton-wave' }, 'PUT');
  assert.equal(profile.status, 200);
  return { ...login, data: profile.data, code: sent.data.developmentCode };
}

test('mastery and mistakes are mutually exclusive, atomic and account-scoped', async () => {
 const f=await fixture();
 try{
  const a=f.client(), b=f.client(); await register(a,'mastery@example.com'); await register(b,'other@example.com');
  const keys=[...questions.keys()].slice(0,36);
  let r=await a('progress',{keys,status:'mastered'},'PUT');assert.equal(r.status,200);assert.equal(Object.keys(r.data.mastered).length,36);assert.equal(Object.keys(r.data.mistakes).length,0);
  r=await a('mistakes',{key:keys[0],marked:true},'PUT');assert.ok(r.data.mistakes[keys[0]]);assert.ok(!r.data.mastered[keys[0]]);
  r=await a('progress',{keys,status:'mistake'},'PUT');assert.equal(Object.keys(r.data.mastered).length,0);assert.equal(Object.keys(r.data.mistakes).length,36);
  assert.equal((await a('progress',{keys:[keys[0],'unknown'],status:'mastered'},'PUT')).status,400);
  assert.equal(Object.keys((await a('mistakes')).data.mistakes).length,36);
  r=await a('progress',{keys,status:'mastered'},'PUT');assert.equal(Object.keys(r.data.mistakes).length,0);
  r=await a('mistakes/trash',{action:'restore',keys:[keys[0]]});assert.ok(r.data.mistakes[keys[0]]);assert.ok(!r.data.mastered[keys[0]]);
  assert.deepEqual((await b('mistakes')).data,{mistakes:{},mastered:{}});
  r=await a('progress',{keys,status:'clear'},'PUT');assert.deepEqual({mistakes:r.data.mistakes,mastered:r.data.mastered},{mistakes:{},mastered:{}});assert.equal(typeof r.data.undoId,'string');
 }finally{await f.close();}
});

test('progress undo restores original timestamps and archive, belongs to its owner, expires and rejects newer changes',async()=>{
 const f=await fixture();
 try{
  const a=f.client(),b=f.client();await register(a,'undo@example.com');await register(b,'undo-other@example.com');
  const keys=['tb-201-1','tb-201-2','2012|paper-1a|1'];
  await a('mistakes',{key:keys[0],marked:true},'PUT');f.advance(1000);
  await a('mistakes',{key:keys[1],marked:true},'PUT');await a('mistakes',{key:keys[1],marked:false},'PUT');
  await a('progress',{keys:[keys[2]],status:'mastered'},'PUT');
  const before=(await a('mistakes')).data,trash=(await a('mistakes/trash')).data;
  f.advance(1000);
  const changed=await a('progress',{keys,status:'mastered'},'PUT');
  assert.equal((await b('progress/undo',{id:changed.data.undoId})).status,409);
  const restored=await a('progress/undo',{id:changed.data.undoId});assert.equal(restored.status,200);assert.deepEqual(restored.data,before);assert.deepEqual((await a('mistakes/trash')).data,trash);
  assert.equal((await a('progress/undo',{id:changed.data.undoId})).status,409);
  const stale=await a('progress',{keys,status:'mastered'},'PUT');
  await a('mistakes',{key:keys[0],marked:true},'PUT');
  const latest=(await a('mistakes')).data;
  assert.equal((await a('progress/undo',{id:stale.data.undoId})).status,409);assert.deepEqual((await a('mistakes')).data,latest);
  const expired=await a('progress',{keys,status:'clear'},'PUT');f.advance(600001);
  assert.equal((await a('progress/undo',{id:expired.data.undoId})).status,409);
 }finally{await f.close();}
});

test('teacher questions preserve exact context and replies are private and admin-only', async()=>{
 const f=await fixture();
 try{
  const a=f.client(),b=f.client(),admin=f.client(),anonymous=f.client();const userA=await register(a,'ask@example.com');const userB=await register(b,'privacy@example.com');await admin('admin/login',{key:'test-admin-key'});
  assert.equal((await a('tutoring')).status,403);
  assert.equal((await a('tutoring',{kind:'general',message:'Member-only question'})).status,403);
  for(const account of [userA,userB]) assert.equal((await admin('admin/membership',{userId:account.data.user.id,action:'extend',days:1,reason:'Test membership',revision:0,requestId:crypto.randomUUID()})).status,200);
  const key=[...questions.keys()][0];
  assert.equal((await anonymous('tutoring')).status,401);
  assert.equal((await a('tutoring',{kind:'question',reference:'bad',message:'Help'})).status,400);
  for(const body of [{kind:'question',reference:key,message:'Why this option?'},{kind:'knowledge',reference:'384',message:'How do these sizes compare?'},{kind:'general',reference:'',message:'How should I pace my study?'}])assert.equal((await a('tutoring',body)).status,200);
  const rows=(await admin('admin/tutoring')).data.rows;assert.equal(rows.length,3);assert.equal(rows.find(r=>r.kind==='question').context.key,key);assert.equal(rows.find(r=>r.kind==='knowledge').context.sequence,384);
  assert.equal((await b('tutoring')).data.rows.length,0);assert.equal((await a('admin/tutoring')).status,403);
  assert.equal((await a('admin/tutoring/reply',{id:rows[0].id,reply:'unauthorized'})).status,403);
  assert.equal((await admin('admin/tutoring/reply',{id:rows[0].id,reply:'  '})).status,400);
  assert.equal((await admin('admin/tutoring/reply',{id:rows[0].id,reply:'Start with the physical principle.'})).status,200);
  assert.equal((await a('tutoring')).data.rows.find(r=>r.id===rows[0].id).reply,'Start with the physical principle.');
  assert.equal((await b('tutoring')).data.rows.length,0);
  assert.equal((await admin('admin/tutoring/reply',{id:rows[0].id,reply:'Overwrite'})).status,409);
  f.advance(86400001);
  assert.equal((await a('tutoring')).status,403);
  assert.equal((await a('tutoring',{kind:'general',message:'Expired member'})).status,403);
 }finally{await f.close();}
});

test('password enrollment requires verified session, confirmation, hashing and rate-limited login', async () => {
  const f = await fixture();
  try {
    const student = f.client(), stranger = f.client();
    const email = 'password@example.com';
    const profile = { nickname: '密碼同學', grade: '中五', target: '5', avatar: 'newton-wave' };
    assert.equal((await stranger('profile', profile, 'PUT')).status, 401);
    const code = await student('auth/code', { email });
    await student('auth/verify', { email, code: code.data.developmentCode });
    assert.equal((await student('profile', profile, 'PUT')).status, 400);
    assert.equal((await student('profile', { ...profile, password: 'Study-pass-123', confirmPassword: 'Different-123' }, 'PUT')).status, 400);
    const saved = await student('profile', { ...profile, password: 'Study-pass-123', confirmPassword: 'Study-pass-123' }, 'PUT');
    assert.equal(saved.data.user.hasPassword, true);
    assert.ok(!JSON.stringify(saved.data).includes('password_hash'));
    const db = new DatabaseSync(join(f.directory, 'students.sqlite'));
    const row = db.prepare('SELECT password_hash FROM users WHERE email=?').get(email);
    assert.match(row.password_hash, /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
    assert.ok(!row.password_hash.includes('Study-pass-123')); db.close();
    await student('auth/logout', {});
    assert.equal((await student('auth/password', { email, password: 'Wrong-pass-123' })).status, 401);
    const login = await student('auth/password', { email: ' PASSWORD@example.com ', password: 'Study-pass-123' });
    assert.equal(login.status, 200); assert.equal(login.data.user.id, saved.data.user.id);
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    assert.equal((await student('profile', profile, 'PUT')).status, 200);
    assert.equal((await student('profile', { ...profile, password: 'Replaced-123', confirmPassword: 'Replaced-123' }, 'PUT')).status, 400);
    const absent = await stranger('auth/password', { email: 'absent@example.com', password: 'Wrong-pass-123' });
    assert.equal(absent.status, 401);
    for (let n = 0; n < 8; n++) assert.equal((await stranger('auth/password', { email, password: 'Wrong-pass-123' })).status, 401);
    assert.equal((await stranger('auth/password', { email, password: 'Study-pass-123' })).status, 429);
    f.advance(61000);
    const retry = await student('auth/code', { email });
    assert.equal((await student('auth/verify', { email, code: retry.data.developmentCode })).status, 200);
  } finally { await f.close(); }
});
test('profile completion, validation, uploaded image normalization and account isolation', async () => {
  const f = await fixture();
  try {
    const student = f.client(), other = f.client(), admin = f.client();
    const email = 'profile@example.com';
    const sent = await student('auth/code', { email });
    const login = await student('auth/verify', { email, code: sent.data.developmentCode });
    assert.equal(login.data.user.profileComplete, false);
    assert.equal((await student('mistakes', { key: [...questions.keys()][0], marked: true }, 'PUT')).status, 403);
    const valid = { nickname: '小牛頓', grade: '中四', target: '5**', targetMajor: '物理學', avatar: 'curie-read' };
    for (const invalid of [{ nickname: ' ' }, { nickname: 'x'.repeat(25) }, { targetMajor: 5 }, { targetMajor: 'x'.repeat(101) }, { targetMajor: 'bad\nmajor' }, { grade: '中三' }, { target: '6' }, { avatar: '../secret' }, { avatar: 'upload' }, { image: 'data:image/svg+xml;base64,PHN2Zz4=' }]) {
      assert.equal((await student('profile', { ...valid, ...invalid }, 'PUT')).status, 400);
    }
    const saved = await student('profile', { ...valid, password: 'Study-pass-123', confirmPassword: 'Study-pass-123' }, 'PUT');
    assert.equal(saved.data.user.nickname, valid.nickname);
    assert.equal(saved.data.user.targetMajor, '物理學');
    assert.equal((await student('auth/session')).data.user.targetMajor, '物理學');
    assert.equal(saved.data.user.profileComplete, true);
    assert.equal(saved.data.user.avatarUrl, '/assets/avatars/curie-read.webp');
    const image = await sharp({ create: { width: 600, height: 300, channels: 3, background: '#5599cc' } }).png().toBuffer();
    const uploaded = await student('profile', { ...valid, image: `data:image/png;base64,${image.toString('base64')}` }, 'PUT');
    assert.equal(uploaded.status, 200); assert.equal(uploaded.data.user.avatar, 'upload');
    assert.equal(uploaded.data.user.avatar_data, undefined);
    // Binary avatars are not exposed to other students or anonymous requests.
    const url = uploaded.data.user.avatarUrl.replace('/api/', '');
    assert.equal((await other(url)).status, 401);
    await register(other, 'otherprofile@example.com');
    assert.equal((await other(url)).status, 403);
    assert.equal((await other('auth/session')).data.user.nickname, 'Test student');
    assert.equal((await other('auth/session')).data.user.targetMajor, '');
    assert.equal((await student('profile', { ...valid, avatar: 'upload', nickname: '更新暱稱' }, 'PUT')).status, 200);
    await admin('admin/login', { key: 'test-admin-key' });
    const stats = (await admin('admin/stats')).data;
    assert.equal(stats.students.find(s => s.email === email).nickname, '更新暱稱');
    const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from((await admin('admin/export')).data.base64, 'base64'));
    const summary = book.getWorksheet('學生摘要').getSheetValues();
    assert.ok(JSON.stringify(summary).includes('更新暱稱')); assert.ok(JSON.stringify(summary).includes('5**'));
    assert.equal((await student('profile', { ...valid, nickname: 'Safe again' }, 'PUT')).data.user.avatar, 'curie-read');
  } finally { await f.close(); }
});
test('registration, persistent sessions, isolation, idempotent marks, import and developer analytics', async () => {
  const f = await fixture();
  try {
    const a = f.client(), b = f.client(), admin = f.client();
    assert.equal((await a('mistakes')).status, 401);
    assert.equal((await a('admin/export')).status, 401);
    const first = await register(a, 'StudentA@example.com');
    assert.match(first.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    assert.equal((await a('auth/session')).data.user.email, 'studenta@example.com');
    assert.equal((await a('auth/verify', { email: 'studenta@example.com', code: first.code })).status, 400);
    await register(b, 'studentb@example.com');
    assert.equal((await a('admin/stats')).status, 403);
    assert.equal((await a('admin/export')).status, 403);
    const keys = [...questions.keys()].slice(0, 2);
    assert.equal((await a('mistakes', { key: keys[0], marked: true }, 'PUT')).status, 200);
    await a('mistakes', { key: keys[0], marked: true }, 'PUT');
    await a('mistakes/import', { keys });
    await b('mistakes', { key: keys[0], marked: true }, 'PUT');
    assert.equal(Object.keys((await b('mistakes')).data.mistakes).length, 1);
    assert.equal((await a('mistakes', { key: 'fake', marked: true }, 'PUT')).status, 400);
    assert.equal((await a('mistakes', { key: keys[0], marked: 'true' }, 'PUT')).status, 400);
    assert.equal((await admin('admin/login', { key: 'bad' })).status, 401);
    await admin('admin/login', { key: 'test-admin-key' });
    const stats = (await admin('admin/stats')).data;
    assert.deepEqual(stats.summary, { students: 2, marks: 3, questions: 2, points: new Set(keys.flatMap(k => questions.get(k).points)).size });
    const expected = new Map();
    for (const key of [keys[0], keys[0], keys[1]]) for (const id of questions.get(key).points) expected.set(id, (expected.get(id) || 0) + 1);
    for (const point of stats.points) assert.equal(point.count, expected.get(point.sequence));
    assert.equal(stats.activity.reduce((sum, row) => sum + row.count, 0), 3);
    const detail = (await admin(`admin/student?id=${first.data.user.id}`)).data;
    assert.equal(detail.mistakes.length, 2); assert.ok(detail.mistakes[0].knowledge.length);
    await a('mistakes', { key: keys[0], marked: false }, 'PUT');
    assert.equal((await admin('admin/stats')).data.summary.marks, 2);
    const exported = await admin('admin/export');
    assert.equal(exported.status, 200);
    assert.equal(exported.data.filename, '學生完整學習資料.xlsx');
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(exported.data.base64, 'base64'));
    const exportedText = JSON.stringify(workbook.worksheets.map(s => ({name:s.name, rows:s.getSheetValues()})));
    assert.equal(workbook.worksheets.length, 5);
    for (const expected of ['學生摘要', '目前錯題', '知識點統計', '章節統計', '操作歷史', '移入回收站', 'studenta@example.com', 'studentb@example.com', keys[0], keys[1]]) assert.ok(exportedText.includes(expected), expected);
    for (const excluded of ['developer@local.invalid', 'test-admin-key', 'digest', 'salt', first.code]) assert.ok(!exportedText.includes(excluded));
    await a('auth/logout', {}); assert.equal((await a('mistakes')).status, 401);
    f.advance(31 * 86400000); assert.equal((await b('mistakes')).status, 401);
  } finally { await f.close(); }
});
test('OTP expiry, resend cooldown, attempt limits, origin and host checks', async () => {
  const f = await fixture();
  try {
    const c = f.client(); const email = 'secure@example.com';
    let sent = await c('auth/code', { email });
    assert.equal((await c('auth/code', { email })).status, 429);
    for (let i = 0; i < 5; i++) assert.equal((await c('auth/verify', { email, code: '000000' })).status, 400);
    assert.equal((await c('auth/verify', { email, code: sent.data.developmentCode })).status, 400);
    f.advance(61000); sent = await c('auth/code', { email });
    f.advance(600001); assert.equal((await c('auth/verify', { email, code: sent.data.developmentCode })).status, 400);
    assert.equal((await c('auth/code', { email }, 'POST', { origin: 'https://evil.example' })).status, 403);
    const hostStatus = await new Promise((resolve, reject) => { const req = request(f.base + '/api/auth/session', { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end(); });
    assert.equal(hostStatus, 403);
    assert.equal((await c('auth/code', { email: 'bad' })).status, 400);
  } finally { await f.close(); }
});
test('SMTP does not expose codes and failed delivery can be retried', async () => {
  let delivered; let fail = true;
  const f = await fixture({ mailer: async (email, code) => { if (fail) throw Error('SMTP unavailable'); delivered = { email, code }; } });
  try {
    const c = f.client(); const email = 'mail@example.com';
    assert.equal((await c('auth/code', { email })).status, 502); fail = false;
    const sent = await c('auth/code', { email }); assert.equal(sent.status, 200); assert.equal(sent.data.developmentCode, undefined);
    assert.equal(delivered.email, email); assert.equal((await c('auth/verify', delivered)).status, 200);
  } finally { await f.close(); }
});
test('database and session survive service restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dse-restart-'));
  let api = createApi({ directory, adminKey: 'key' });
  const server = createServer((req, res) => api.handler(req, res, () => res.end()));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  try {
    const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const { developmentCode } = await (await post('auth/code', { email: 'persist@example.com' })).json();
    const login = await post('auth/verify', { email: 'persist@example.com', code: developmentCode });
    const cookie = login.headers.get('set-cookie').split(';')[0]; await login.json();
    await (await fetch(base + 'profile', { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({password:'Study-pass-123',confirmPassword:'Study-pass-123',nickname:'Persistent',targetMajor:'工程學',grade:'中六',target:'5**',avatar:'einstein-think'}) })).json();
    const key = [...questions.keys()][0];
    await (await fetch(base + 'mistakes', { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ key, marked: true }) })).json();
    await fetch(base + 'focus', { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({sessions:[{id:'persist-focus',elapsedMs:3600000}]}) });
    api.close(); api = createApi({ directory, adminKey: 'key' });
    assert.equal((await (await fetch(base + 'focus', {headers:{cookie}})).json()).sessions[0].elapsedMs,3600000);
    const response = await fetch(base + 'mistakes', { headers: { cookie } });
    assert.equal(response.status, 200); assert.ok((await response.json()).mistakes[key]);
    assert.equal((await (await fetch(base + 'auth/session', { headers: { cookie } })).json()).user.targetMajor, '工程學');
  } finally { await new Promise(resolve => server.close(resolve)); api.close(); rmSync(directory, { recursive: true }); }
});

test('focus totals are isolated, idempotent, monotonic and persistent', async () => {
 const f = await fixture();
 try {
  const student = f.client(), other = f.client(), stranger = f.client();
  assert.equal((await stranger('focus')).status,401);
  await register(student,'focus@example.com');await register(other,'focus-other@example.com');
  const put = sessions => student('focus',{sessions},'PUT');
  assert.equal((await put([{id:'one',elapsedMs:60000}])).status,200);
  await put([{id:'one',elapsedMs:60000}]);await put([{id:'one',elapsedMs:30000}]);
  assert.deepEqual((await student('focus')).data.sessions,[{id:'one',elapsedMs:60000}]);
  await put([{id:'one',elapsedMs:120000},{id:'two',elapsedMs:180000}]);
  assert.equal((await student('focus')).data.sessions.reduce((n,s)=>n+s.elapsedMs,0),300000);
  assert.deepEqual((await other('focus')).data.sessions,[]);
  for(const elapsedMs of [-1,10800001,0.5,'1000']) assert.equal((await put([{id:'bad',elapsedMs}])).status,400);
  assert.equal((await put([{id:'',elapsedMs:1000}])).status,400);
  assert.equal((await put([{id:'valid',elapsedMs:1000},{id:'bad',elapsedMs:-1}])).status,400);
  assert.equal((await student('focus')).data.sessions.length,2);
 } finally {await f.close();}
});
