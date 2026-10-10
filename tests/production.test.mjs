import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createApi } from '../server/api.mjs';
import { createProductionServer, productionConfig } from '../server/production.mjs';

function fetchLocal(server, path, { body, headers = {}, method = body ? 'POST' : 'GET' } = {}) {
  return new Promise((done, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path, method, headers: { host: 'study.example.com', ...(body ? { 'content-type': 'application/json' } : {}), ...headers } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', chunk => text += chunk); res.on('end', () => done({ status: res.statusCode, headers: res.headers, text }));
    }); req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
  });
}

test('public production server protects accounts and premium files while serving both entries', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dse-production-'));
  const delivered = [];
  const api = createApi({ directory, adminKey: 'production-test-only', publicOrigins: ['https://study.example.com'], secureCookies: true, trustProxy: true, mailer: async (email, code) => delivered.push({ email, code }) });
  const server = createProductionServer({ api, origins: ['https://study.example.com'] });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  try {
    for (const path of ['/', '/admin.html']) assert.equal((await fetchLocal(server, path)).status, 200, path);
    assert.equal((await fetchLocal(server, '/admin/')).headers.location, '/admin.html');
    assert.equal((await fetchLocal(server, '/api/auth/session')).status, 200);
    assert.equal((await fetchLocal(server, '/', { headers: { host: 'attacker.example' } })).status, 403);
    assert.equal((await fetchLocal(server, '/api/auth/code', { body: { email: 'student@example.com' }, headers: { origin: 'https://attacker.example' } })).status, 403);
    assert.equal((await fetchLocal(server, '/api/auth/code', { body: { email: 'student@example.com' }, headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
    assert.equal(delivered.length, 0);
    for (const path of ['/.env.local', '/.local/students.sqlite', '/server/api.mjs', '/%2eenv.local', '/%2e%2e/.env.local', '/assets/../../.env.local', '/downloads/chn/knowledge.pdf', '/node_modules/nodemailer/package.json']) assert.notEqual((await fetchLocal(server, path)).status, 200, path);
    for (const path of ['/api/admin/stats', '/api/admin/orders', '/api/admin/question-stats/export', '/api/premium/network', '/api/mistakes']) assert.equal((await fetchLocal(server, path)).status, 401, path);
    const sent = await fetchLocal(server, '/api/auth/code', { body: { email: 'student@example.com' }, headers: { origin: 'https://study.example.com' } });
    assert.equal(sent.status, 200); assert.equal(JSON.parse(sent.text).developmentCode, undefined); assert.equal(delivered.length, 1);
    const login = await fetchLocal(server, '/api/auth/verify', { body: { email: 'student@example.com', code: delivered[0].code } });
    assert.equal(login.status, 200); assert.match(login.headers['set-cookie'][0], /; Secure/); assert.match(login.headers['set-cookie'][0], /HttpOnly/);
    assert.equal((await fetchLocal(server, '/api/admin/question-stats/export', { headers: { cookie: login.headers['set-cookie'][0].split(';')[0] } })).status, 403);
    const logout = await fetchLocal(server, '/api/auth/logout', { body: {}, headers: { cookie: login.headers['set-cookie'][0].split(';')[0] } });
    assert.match(logout.headers['set-cookie'][0], /; Secure/);
    const paper = await fetchLocal(server, '/text-papers/2025-eng.json');
    assert.equal(paper.status, 404);
    assert.equal((await fetchLocal(server, '/knowledge-network-data.js')).text, 'window.DSE_KNOWLEDGE_NETWORK={};');
    const admin = await fetchLocal(server, '/api/admin/login', { body: { key: 'production-test-only' } });
    assert.equal(admin.status, 200); assert.match(admin.headers['set-cookie'][0], /^dse_admin_session=.*; Secure$/);
    const exported = await fetchLocal(server, '/api/admin/question-stats/export', { headers: { cookie: admin.headers['set-cookie'][0].split(';')[0] } });
    assert.equal(exported.status, 200);
    const workbook = JSON.parse(exported.text);
    assert.equal(workbook.filename, '逐题统计.xlsx'); assert.equal(workbook.count, 0);
    assert.equal(Buffer.from(workbook.base64, 'base64').subarray(0, 2).toString(), 'PK');
  } finally { await new Promise(done => server.close(done)); api.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('production cannot silently enable local verification codes or insecure origins', () => {
  assert.throws(() => productionConfig({}), /HTTPS/);
  assert.throws(() => productionConfig({ PUBLIC_ORIGINS: 'http://study.example.com' }), /HTTPS/);
  assert.throws(() => productionConfig({ PUBLIC_ORIGINS: 'https://study.example.com', DSE_DATA_DIR: '/var/data' }), /SMTP_HOST/);
  assert.throws(() => createApi({ secureCookies: true, publicOrigins: ['https://study.example.com'] }), /email delivery/);
});

test('maintenance permits health checks but blocks all student and admin activity', async () => {
  const server = createProductionServer({ api: { handler: () => { throw new Error('API must not run'); } }, origins: ['https://study.example.com'], maintenance: true });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  try {
    assert.equal((await fetchLocal(server, '/healthz')).status, 200);
    for (const path of ['/', '/admin.html', '/api/auth/session']) assert.equal((await fetchLocal(server, path)).status, 503);
  } finally { await new Promise(done => server.close(done)); }
});
