import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { createApi } from '../server/api.mjs';
import { createContentLimiter } from '../server/content-limits.mjs';
import { openDatabase } from '../server/database.mjs';
import { createSecurityAlerts } from '../server/security-alerts.mjs';

test('content alerts email the administrator and only a reviewed student account can be banned', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dse-security-'));
  const messages = [];
  const adminKey = 'security-fixture-only';
  let now = Date.now();
  const options = {
    directory, adminKey, clock: () => now, securityFrom: 'fixture@example.invalid',
    securityMailer: async message => { messages.push(message); },
    contentLimits: { detail: 1, knowledge: 1 }, localTestEmail: 'student@example.test'
  };
  let api = createApi(options);
  const server = createServer((req, res) => api.handler(req, res, () => {
    if (!api.protectFiles(req, res)) { res.writeHead(404); res.end(); }
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const list = '/api/admin/security-alerts';
  const review = list + '/review';
  const question = '/api/content/question?id=2025%7Cpaper-1a%7C1&language=eng';
  const userAgent = 'Example crawler <img src=x>';
  const client = () => {
    let cookie = '';
    return async (path, body, headers, method = 'POST') => {
      const response = await fetch(origin + path, {
        headers: { cookie, 'user-agent': userAgent, ...(body && { 'Content-Type': 'application/json' }), ...headers },
        ...(body && { method, body: JSON.stringify(body) })
      });
      if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      const raw = await response.text();
      return { status: response.status, data: response.headers.get('content-type')?.startsWith('application/json') ? JSON.parse(raw) : raw };
    };
  };
  const admin = client(), student = client(), other = client(), guest = client();
  const email = 'student@example.test';
  async function verify(as, address) {
    const { data } = await as('/api/auth/code', { email: address });
    return as('/api/auth/verify', { email: address, code: data.developmentCode });
  }

  try {
    assert.equal((await admin('/api/admin/login', { key: adminKey })).status, 200);
    const studentId = (await verify(student, email)).data.user.id;
    assert.equal((await verify(other, 'other@example.test')).status, 200);
    assert.equal((await student('/api/profile', {
      password: 'fixture-password-17', confirmPassword: 'fixture-password-17',
      nickname: 'Fixture', targetMajor: '工程學', grade: '中六', target: '5**', avatar: 'einstein-think'
    }, undefined, 'PUT')).status, 200);
    assert.equal((await student(question)).status, 200);
    assert.equal((await admin(list)).data.rows.length, 0);
    assert.equal((await student(question, undefined, { 'x-forwarded-for': '198.51.100.5' })).status, 429);
    assert.equal((await student(question)).status, 429);
    assert.equal((await other(question)).status, 200);
    assert.equal((await guest('/textbook-data.js')).status, 200);
    assert.equal((await guest('/textbook-data.js')).status, 429);
    const { rows } = (await admin(list)).data;
    assert.equal(rows.length, 2);
    const alert = rows.find(row => row.scope === 'account');
    const anonymous = rows.find(row => row.scope === 'guest');
    assert.equal(alert.user_id, studentId);
    assert.equal(alert.decision, 'pending');
    assert.equal(alert.occurrences, 1);
    assert.equal(alert.evidence.ip, '127.0.0.1');
    assert.equal(alert.evidence.count, 2);
    assert.equal(alert.evidence.path, '/api/content/question');
    assert.equal(alert.evidence.userAgent, userAgent);
    assert.equal(anonymous.user_id, null);
    assert.equal(messages.length, 2);
    const message = messages.find(mail => mail.text.includes(email));
    assert.equal(message.to, 'rodrickgao@gmail.com');
    assert.match(message.text, /2 次，限额 1 次/);
    assert.ok(message.text.includes('https://ddphysics.com/admin.html#security?alert=' + alert.id));
    assert.doesNotMatch(message.html, /<img src=x>/);
    assert.match(message.html, /&lt;img src=x&gt;/);
    assert.doesNotMatch(message.text, /2025%7C/);

    assert.equal((await guest(review, { id: alert.id, action: 'ban' })).status, 401);
    assert.equal((await student(review, { id: alert.id, action: 'ban' })).status, 403);
    assert.equal((await admin(review, { id: alert.id, action: 'ban' }, { origin: 'https://example.test' })).status, 403);
    assert.equal((await admin(review + '?id=' + alert.id)).status, 404);
    assert.equal((await admin(list + '?id=' + alert.id)).data.rows[0].decision, 'pending');
    assert.equal((await admin(review, { id: anonymous.id, action: 'ban' })).status, 409);
    assert.equal((await admin(review, { id: anonymous.id, action: 'dismiss' })).data.alert.decision, 'dismissed');
    const banned = (await admin(review, { id: alert.id, action: 'ban' })).data.alert;
    assert.equal(banned.decision, 'banned');
    assert.equal(banned.banned_at, now);
    assert.ok(banned.reviewed_by);
    assert.equal((await admin(review, { id: alert.id, action: 'ban' })).data.alert.reviewed_at, banned.reviewed_at);
    assert.equal((await student('/api/auth/session')).data.user, null);
    assert.equal((await student('/api/progress')).status, 401);
    assert.equal((await guest('/api/auth/password', { email, password: 'fixture-password-17' })).status, 403);
    now += 61000;
    assert.equal((await verify(guest, email)).status, 403);
    assert.ok((await other('/api/auth/session')).data.user);
    api.close();
    api = createApi(options);
    assert.equal((await admin(list + '?id=' + alert.id)).data.rows[0].decision, 'banned');
    assert.equal((await guest('/api/auth/password', { email, password: 'fixture-password-17' })).status, 403);
    assert.equal(messages.length, 2);
  } finally {
    await new Promise(resolve => server.close(resolve));
    api.close();
    rmSync(directory, { recursive: true });
  }
});

test('distinct and shared-IP limits retain the right identity, and security email retries after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dse-security-delivery-'));
  const db = openDatabase(directory);
  const res = { setHeader() {} };
  const signals = [];
  let now = Date.now();
  const clock = () => now;
  const origin = 'https://ddphysics.com';
  const send = [];
  const storeOptions = { db, clock, origin, fail: assert.fail };
  const req = id => ({
    url: '/api/content/question?id=' + id,
    contentClientIp: '198.51.100.5', socket: { remoteAddress: '127.0.0.1' }
  });
  const limit = createContentLimiter({ db, clock, onLimit: signal => { signals.push(signal); }, config: { detail: 1, distinctHour: 2 } });
  let store = createSecurityAlerts({ ...storeOptions, sendMail: async () => { throw Object.assign(new Error(), { code: 'TEST_FAILURE' }); } });
  try {
    for (let id = 1; id <= 40; id++) limit(req('1'), res, { id, role: 'student' }, 'detail');
    assert.throws(() => limit(req('1'), res, { id: 41, role: 'student' }, 'detail'), { status: 429 });
    const shared = signals[0];
    assert.equal(shared.scope, 'shared');
    assert.equal(shared.user, null);
    assert.equal(shared.evidence.ip, '198.51.100.5');
    store.record(shared);
    await setImmediate();
    assert.equal(store.read(null).rows[0].mailStatus, 'retry');
    store.close();
    now += 10 * 60000;
    store = createSecurityAlerts({ ...storeOptions, sendMail: async message => { send.push(message); } });
    await setImmediate();
    assert.equal(store.read(null).rows[0].mailStatus, 'sent');
    assert.equal(send.length, 1);
    assert.match(send[0].text, /无可封禁账号/);
    assert.doesNotMatch(send[0].text, /审核并封号/);
    const student = { id: 1, role: 'student' };
    limit(req('2'), res, student, 'detail');
    assert.throws(() => limit(req('3'), res, student, 'detail'), { status: 429 });
    assert.equal(signals[1].reason, 'distinct');
    assert.equal(signals[1].user, student);
    assert.equal(signals[1].evidence.count, 3);
  } finally {
    store.close();
    db.close();
    rmSync(directory, { recursive: true });
  }
});
