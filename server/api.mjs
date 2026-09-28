import { studentLearning } from './student-learning.mjs';
import { createTutoring } from './tutoring.mjs';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { questions, pointInfo } from './catalog.mjs';
import { exportRows, toWorkbook } from './student-export.mjs';
import { publicProfile, validateProfile } from './profile.mjs';
import { encodePassword, checkPassword } from './password.mjs';
import { createManagement } from './management.mjs';
import { premiumNetwork } from './premium.mjs';
import { createMistakeArchive } from './mistake-archive.mjs';
import { createPaymentOrders } from './payment-orders.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const publicUser = publicProfile;

export function createApi({ directory, mailer, clock = Date.now, adminKey: suppliedKey, publicOrigins = [], secureCookies = false, trustProxy = false } = {}) {
  const allowedOrigins = new Set(publicOrigins);
  const allowedHosts = new Set(publicOrigins.map(value => new URL(value).host));
  if (secureCookies && (!mailer || !allowedOrigins.size)) throw new Error('Production requires email delivery and an explicit HTTPS origin.');
  mkdirSync(directory, { recursive: true });
  const keyPath = join(directory, 'admin-key.txt');
  if (!suppliedKey && !existsSync(keyPath)) writeFileSync(keyPath, token(), { mode: 0o600 });
  const adminKey = suppliedKey || readFileSync(keyPath, 'utf8').trim();
  const db = new DatabaseSync(join(directory, 'students.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, role TEXT NOT NULL DEFAULT 'student', created_at INTEGER NOT NULL, last_login INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS codes(email TEXT PRIMARY KEY, digest TEXT NOT NULL, salt TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, sent_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(digest TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mistakes(user_id INTEGER NOT NULL REFERENCES users(id), question_key TEXT NOT NULL, marked_at INTEGER NOT NULL, PRIMARY KEY(user_id,question_key));
    CREATE TABLE IF NOT EXISTS progress_undo(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), snapshot TEXT NOT NULL, after_state TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mastered(user_id INTEGER NOT NULL REFERENCES users(id), question_key TEXT NOT NULL, marked_at INTEGER NOT NULL, PRIMARY KEY(user_id,question_key));
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), question_key TEXT NOT NULL, action TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS focus_sessions(user_id INTEGER NOT NULL REFERENCES users(id), id TEXT NOT NULL, elapsed_ms INTEGER NOT NULL, PRIMARY KEY(user_id,id));
    CREATE TABLE IF NOT EXISTS limits(bucket TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS limits_bucket ON limits(bucket,at);
    CREATE INDEX IF NOT EXISTS events_at ON events(at);`);
  const columns = new Set(db.prepare('PRAGMA table_info(users)').all().map(c => c.name));
  for (const [name, type] of Object.entries({ nickname: 'TEXT', grade: 'TEXT', target: 'TEXT', target_major: 'TEXT', avatar: 'TEXT', avatar_data: 'BLOB', avatar_version: 'TEXT', password_hash: 'TEXT' })) {
    if (!columns.has(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
  }
  const get = (sql, ...params) => db.prepare(sql).get(...params);
  const all = (sql, ...params) => db.prepare(sql).all(...params);
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const management = createManagement({ db, clock, fail, transaction });
  const archive = createMistakeArchive({ db, clock, fail, transaction, record: management.record, questions });
  const tutoring = createTutoring({ db, clock, fail });
  const mastered = userId => Object.fromEntries(all('SELECT question_key,marked_at FROM mastered WHERE user_id=?',userId).map(r => [r.question_key,{markedAt:new Date(r.marked_at).toISOString()}]));
  const progress = userId => ({ mistakes:marked(userId), mastered:mastered(userId) });
  const payments = createPaymentOrders({ db, clock, fail, transaction, management });
  function limit(bucket, count, interval) {
    run('DELETE FROM limits WHERE at < ?', clock() - 3600000);
    if (get('SELECT count(*) n FROM limits WHERE bucket=? AND at>?', bucket, clock() - interval).n >= count) fail(429, '操作過於頻繁，請稍後再試。');
    run('INSERT INTO limits VALUES(?,?)', bucket, clock());
  }
  function session(req, admin = false) {
    const name = admin ? 'dse_admin_session' : 'dse_session';
    const raw = new RegExp(`(?:^|;\\s*)${name}=([a-f0-9]{64})(?:;|$)`).exec(req.headers.cookie || '')?.[1];
    return raw && get('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE digest=? AND expires>?', hash(raw), clock());
  }
  function signIn(res, email, role = 'student') {
    run('INSERT INTO users(email,role,created_at,last_login) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET last_login=excluded.last_login', email, role, clock(), clock());
    const user = get('SELECT * FROM users WHERE email=?', email);
    const raw = token();
    run('DELETE FROM sessions WHERE expires <= ?', clock());
    run('INSERT INTO sessions VALUES(?,?,?)', hash(raw), user.id, clock() + 30 * 86400000);
    res.setHeader('Set-Cookie', `${role === 'admin' ? 'dse_admin_session' : 'dse_session'}=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${role === 'admin' ? 28800 : 2592000}${secureCookies ? '; Secure' : ''}`);
    if (role === 'admin') run('UPDATE sessions SET expires=? WHERE digest=?', clock() + 28800000, hash(raw));
    else management.record(user.id, 'login');
    return publicUser(user);
  }
  function marked(userId) {
    return Object.fromEntries(all('SELECT question_key,marked_at FROM mistakes WHERE user_id=?', userId).map(row => [row.question_key, { markedAt: new Date(row.marked_at).toISOString(), chapterCode: questions.get(row.question_key)?.chapterCode || '', primaryChapterCode: questions.get(row.question_key)?.primaryChapterCode || '' }]));
  }
  function setMarked(userId, key, value) {
    if (!questions.has(key)) fail(400, '題目不存在。');
    if (value) run('DELETE FROM mastered WHERE user_id=? AND question_key=?',userId,key);
    const exists = get('SELECT 1 FROM mistakes WHERE user_id=? AND question_key=?', userId, key);
    if (Boolean(exists) === value) return;
    if (value) run('INSERT INTO mistakes VALUES(?,?,?)', userId, key, clock());
    else run('DELETE FROM mistakes WHERE user_id=? AND question_key=?', userId, key);
    archive.mark(userId, key, value);
    const event = run('INSERT INTO events(user_id,question_key,action,at) VALUES(?,?,?,?)', userId, key, value ? 'mark' : 'unmark', clock());
    if (get('SELECT role FROM users WHERE id=?', userId)?.role === 'student') management.record(userId, value ? 'mark' : 'unmark', key, `legacy-${event.lastInsertRowid}`);
  }
  function aggregate(rows) {
    const byPoint = new Map(); const byQuestion = new Map(); const byChapter = new Map();
    const add = (map, key, info, user) => { if (!map.has(key)) map.set(key, { ...info, count: 0, students: new Set() }); const v = map.get(key); v.count++; v.students.add(user); };
    for (const row of rows) {
      const q = questions.get(row.question_key); if (!q) continue;
      add(byQuestion, q.key, q, row.user_id);
      const chapters = new Set();
      for (const id of q.points) { const info = pointInfo(id); add(byPoint, id, info, row.user_id); chapters.add(info.chapter); }
      for (const chapter of chapters) add(byChapter, chapter, { chapter }, row.user_id);
    }
    const list = map => [...map.values()].map(v => ({ ...v, students: v.students.size })).sort((a, b) => b.count - a.count);
    return { points: list(byPoint), questions: list(byQuestion), chapters: list(byChapter) };
  }
  async function handler(req, res, next) {
    if (!req.url.startsWith('/api/')) return next();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = data => res.end(JSON.stringify(data));
    try {
      if (allowedHosts.size ? !allowedHosts.has(req.headers.host) : !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) fail(403, '不允許此網站存取。');
      if (req.headers.origin && (allowedOrigins.size ? !allowedOrigins.has(req.headers.origin) : req.headers.origin !== `http://${req.headers.host}`)) fail(403, '來源驗證失敗。');
      if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, '來源驗證失敗。');
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      let body = {};
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        if (!req.headers['content-type']?.startsWith('application/json')) fail(415, '需要 JSON 格式。');
        let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > (path === '/api/orders' ? 7100000 : path === '/api/profile' ? 3000000 : 32768)) fail(413, '資料過大。'); }
        try { body = JSON.parse(raw || '{}'); } catch { fail(400, '資料格式錯誤。'); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, '資料格式錯誤。');
      }
      // Enable only behind a trusted proxy that appends the actual client address.
      const ip = (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',').at(-1).trim()) || req.socket.remoteAddress;
      if (path === '/api/auth/session' && req.method === 'GET') {
        const user = session(req); return send({ user: user ? publicUser(user) : null, mailMode: mailer ? 'smtp' : 'local' });
      }
      if (path === '/api/auth/code' && req.method === 'POST') {
        const email = String(body.email || '').trim().toLowerCase();
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith('.invalid')) fail(400, '請輸入有效的電郵地址。');
        limit(`send:${ip}`, 20, 3600000);
        const old = get('SELECT * FROM codes WHERE email=?', email);
        if (old && clock() - old.sent_at < 60000) fail(429, '請等候 60 秒後再索取驗證碼。');
        const code = String(randomInt(100000, 1000000)); const salt = token();
        run('INSERT INTO codes VALUES(?,?,?,?,0,?) ON CONFLICT(email) DO UPDATE SET digest=excluded.digest,salt=excluded.salt,expires=excluded.expires,attempts=0,sent_at=excluded.sent_at', email, hash(salt + code), salt, clock() + 600000, clock());
        if (mailer) { try { await mailer(email, code); } catch { run('DELETE FROM codes WHERE email=? AND salt=?', email, salt); fail(502, '電郵未能寄出，請稍後再試或聯絡開發者。'); } }
        return send({ message: mailer ? '驗證碼已寄出，10 分鐘內有效。' : '本機測試模式：驗證碼未寄出，請使用下方預覽。', ...(mailer ? {} : { developmentCode: code }) });
      }
      if (path === '/api/auth/verify' && req.method === 'POST') {
        limit(`verify:${ip}`, 60, 900000);
        const email = String(body.email || '').trim().toLowerCase();
        const row = get('SELECT * FROM codes WHERE email=?', email);
        if (!row || row.expires <= clock() || row.attempts >= 5) fail(400, '驗證碼已失效，請重新索取。');
        run('UPDATE codes SET attempts=attempts+1 WHERE email=?', email);
        if (hash(row.salt + String(body.code)) !== row.digest) fail(400, '驗證碼不正確。');
        return send(transaction(() => { run('DELETE FROM codes WHERE email=?', email); return { user: signIn(res, email) }; }));
      }
      if (path === '/api/auth/password' && req.method === 'POST') {
        const email = String(body.email || '').trim().toLowerCase();
        limit(`password-ip:${ip}`, 30, 900000);
        limit(`password-email:${email}`, 10, 900000);
        const account = get("SELECT * FROM users WHERE email=? AND role='student'", email);
        if (!await checkPassword(body.password, account?.password_hash)) fail(401, '電郵或密碼不正確；未設定密碼可使用電郵驗證碼登入。');
        return send({ user: signIn(res, email) });
      }
      if (path === '/api/admin/login' && req.method === 'POST') {
        limit(`admin:${ip}`, 10, 900000);
        if (!timingSafeEqual(Buffer.from(hash(String(body.key || ''))), Buffer.from(hash(adminKey)))) fail(401, '開發者密鑰不正確。');
        return send({ user: signIn(res, 'developer@local.invalid', 'admin') });
      }
      if (['/api/auth/logout', '/api/admin/logout'].includes(path) && req.method === 'POST') {
        const name = path.includes('/admin/') ? 'dse_admin_session' : 'dse_session';
        const raw = new RegExp(`(?:^|;\\s*)${name}=([a-f0-9]{64})(?:;|$)`).exec(req.headers.cookie || '')?.[1];
        const departing = session(req, name === 'dse_admin_session');
        if (departing?.role === 'student') management.record(departing.id, 'logout');
        if (raw) run('DELETE FROM sessions WHERE digest=?', hash(raw));
        res.setHeader('Set-Cookie', `${name}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies ? '; Secure' : ''}`);
        return send({ ok: true });
      }
      const user = path.startsWith('/api/admin/') ? session(req, true) || session(req) : session(req) || (/^\/api\/avatar\//.test(path) ? session(req, true) : null); if (!user) fail(401, '請先登入。');
      if (path.startsWith('/api/admin/') && user.role !== 'admin') fail(403, '只限開發者存取。');
      if (path === '/api/admin/session' && req.method === 'GET') return send({ user: publicUser(user) });
      if (path === '/api/membership' && req.method === 'GET') return send({ membership: management.membership(user.id), accessMode: 'chapter-downloads-links-reasoning-tutoring' });
      if (path === '/api/premium/network' && req.method === 'GET') {
        if (user.role !== 'admin' && !management.membership(user.id).active) fail(403, '知識點關聯需要有效會員。');
        return send({ network: premiumNetwork });
      }
      if (path === '/api/admin/tutoring' && req.method === 'GET') return send({ rows:tutoring.list() });
      if (path === '/api/admin/tutoring/reply' && req.method === 'POST') return send(tutoring.reply(user,body));
      if (path === '/api/admin/overview' && req.method === 'GET') return send(management.overview());
      if (path === '/api/admin/activity' && req.method === 'GET') return send(management.activity(url));
      if (path === '/api/admin/membership-history' && req.method === 'GET') return send({ rows: management.history(Number(url.searchParams.get('userId')) || 0) });
      if (path === '/api/admin/membership' && req.method === 'POST') return send(management.change(user, body));
      if (path === '/api/orders' && req.method === 'GET') return send({order:payments.latest(user.id)});
      if (path === '/api/admin/orders' && req.method === 'GET') return send(payments.list());
      if (path === '/api/admin/orders/receipt' && req.method === 'GET') { const image = payments.receipt(url.searchParams.get('id')); res.setHeader('Content-Type','image/webp'); return res.end(image); }
      if (path === '/api/admin/orders/review' && req.method === 'POST') return send(payments.review(user,body));
      if (path === '/api/profile' && req.method === 'PUT') {
        if (user.role !== 'student') fail(403, '此功能供學生使用。');
        limit(`profile:${user.id}`, 30, 60000);
        const profile = await validateProfile(body, user);
        let passwordHash = null;
        if (!user.password_hash && (!publicUser(user).profileComplete || body.password || body.confirmPassword)) passwordHash = await encodePassword(body.password, body.confirmPassword);
        if (user.password_hash && (body.password || body.confirmPassword)) fail(400, '此帳號已設定密碼。');
        transaction(() => {
          run('UPDATE users SET nickname=?,grade=?,target=?,target_major=?,avatar=?,avatar_data=?,avatar_version=? WHERE id=?', profile.nickname, profile.grade, profile.target, profile.targetMajor, profile.avatar, profile.bytes, token().slice(0,16), user.id);
          if (passwordHash) run('UPDATE users SET password_hash=? WHERE id=? AND password_hash IS NULL', passwordHash, user.id);
          management.record(user.id, 'profile_update');
        });
        return send({ user: publicUser(get('SELECT * FROM users WHERE id=?', user.id)) });
      }
      if (/^\/api\/avatar\/\d+$/.test(path) && req.method === 'GET') {
        const id = Number(path.split('/').at(-1));
        if (user.role !== 'admin' && user.id !== id) fail(403, '無權存取此頭像。');
        const avatar = get('SELECT avatar_data FROM users WHERE id=?', id)?.avatar_data;
        if (!avatar) fail(404, '找不到頭像。');
        res.setHeader('Content-Type', 'image/webp'); return res.end(Buffer.from(avatar));
      }
      if (user.role === 'student' && !publicUser(user).profileComplete && req.method !== 'GET') fail(403, '請先完成學生資料。');
      if (path === '/api/orders' && req.method === 'POST') {
        limit(`payment:${user.id}`,20,60000);
        return send(await payments.submit(user,body));
      }
      if (path === '/api/activity' && req.method === 'POST') {
        limit(`activity:${user.id}`, 180, 60000);
        return send(management.track(user, body));
      }
      if (path === '/api/focus' && ['GET', 'PUT'].includes(req.method)) {
        if (req.method === 'PUT') {
          if (!Array.isArray(body.sessions) || body.sessions.length > 200 || body.sessions.some(item => !item || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || !Number.isSafeInteger(item.elapsedMs) || item.elapsedMs < 0 || item.elapsedMs > 180 * 60000)) fail(400, '專注記錄格式不正確。');
          transaction(() => { for (const item of body.sessions) run('INSERT INTO focus_sessions(user_id,id,elapsed_ms) VALUES(?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET elapsed_ms=MAX(focus_sessions.elapsed_ms,excluded.elapsed_ms)', user.id, item.id, item.elapsedMs); });
        }
        return send({ sessions: all('SELECT id,elapsed_ms AS elapsedMs FROM focus_sessions WHERE user_id=?', user.id) });
      }
      if (path === '/api/tutoring' && user.role !== 'admin' && !management.membership(user.id).active) fail(403, '问老师需要有效会员。');
      if (path === '/api/tutoring' && req.method === 'GET') return send({ rows:tutoring.list(user.id) });
      if (path === '/api/tutoring' && req.method === 'POST') {
        limit(`tutoring:${user.id}`,20,3600000); return send(tutoring.submit(user.id,body));
      }
      const progressSnapshot = keys => keys.map(key => ({key,
        mistake:get('SELECT marked_at FROM mistakes WHERE user_id=? AND question_key=?',user.id,key)?.marked_at ?? null,
        mastered:get('SELECT marked_at FROM mastered WHERE user_id=? AND question_key=?',user.id,key)?.marked_at ?? null,
        archive:get('SELECT marked_at,status,trashed_at,deleted_at FROM mistake_archive WHERE user_id=? AND question_key=?',user.id,key) || null
      }));
      if (path === '/api/progress/undo' && req.method === 'POST') {
        const undo=get('SELECT * FROM progress_undo WHERE id=? AND user_id=?',String(body.id||''),user.id);
        if(!undo || clock()-undo.created_at>600000) fail(409,'撤销已过期，请重新调整学习状态。');
        const snapshot=JSON.parse(undo.snapshot),keys=snapshot.map(row=>row.key);
        transaction(()=>{
          if(JSON.stringify(progressSnapshot(keys))!==undo.after_state) fail(409,'这些题目的状态已再次改变，请刷新后查看。');
          for(const row of snapshot){
            for(const table of ['mistakes','mastered','mistake_archive']) run(`DELETE FROM ${table} WHERE user_id=? AND question_key=?`,user.id,row.key);
            if(row.mistake!==null) run('INSERT INTO mistakes VALUES(?,?,?)',user.id,row.key,row.mistake);
            if(row.mastered!==null) run('INSERT INTO mastered VALUES(?,?,?)',user.id,row.key,row.mastered);
            if(row.archive) run('INSERT INTO mistake_archive VALUES(?,?,?,?,?,?)',user.id,row.key,row.archive.marked_at,row.archive.status,row.archive.trashed_at,row.archive.deleted_at);
          }
          run('DELETE FROM progress_undo WHERE id=?',undo.id);
        });
        return send(progress(user.id));
      }
      if (path === '/api/progress' && req.method === 'PUT') {
        if (!Array.isArray(body.keys) || !body.keys.length || body.keys.length>questions.size || body.keys.some(k=>!questions.has(k)) || !['mastered','mistake','clear'].includes(body.status)) fail(400,'请选择有效的题目和学习状态。');
        const undoId=token(), keys=[...new Set(body.keys)];
        transaction(() => { const snapshot=progressSnapshot(keys); for (const key of keys) {
          setMarked(user.id,key,body.status==='mistake');
          if(body.status==='mastered') run('INSERT INTO mastered VALUES(?,?,?) ON CONFLICT(user_id,question_key) DO UPDATE SET marked_at=excluded.marked_at',user.id,key,clock());
          else run('DELETE FROM mastered WHERE user_id=? AND question_key=?',user.id,key);
        }
          run('DELETE FROM progress_undo WHERE created_at<?',clock()-600000);
          run('INSERT INTO progress_undo VALUES(?,?,?,?,?)',undoId,user.id,JSON.stringify(snapshot),JSON.stringify(progressSnapshot(keys)),clock());
        });
        return send({...progress(user.id),undoId});
      }
      if (path === '/api/mistakes' && req.method === 'GET') return send(progress(user.id));
      if (path === '/api/mistakes/trash' && req.method === 'GET') return send({ trash: archive.list(user.id) });
      if (path === '/api/mistakes/trash' && req.method === 'POST') {
        archive.act(user.id, body);
        run('DELETE FROM mastered WHERE user_id=? AND question_key IN (SELECT question_key FROM mistakes WHERE user_id=?)',user.id,user.id);
        return send({ ...progress(user.id), trash: archive.list(user.id) });
      }
      if (path === '/api/mistakes' && req.method === 'PUT') {
        if (typeof body.marked !== 'boolean' || typeof body.key !== 'string') fail(400, '錯題格式不正確。');
        transaction(() => setMarked(user.id, body.key, body.marked)); return send(progress(user.id));
      }
      if (path === '/api/mistakes/import' && req.method === 'POST') {
        if (!Array.isArray(body.keys) || body.keys.length > questions.size || body.keys.some(k => !questions.has(k))) fail(400, '匯入的題目資料不正確。');
        transaction(() => { for (const key of new Set(body.keys)) setMarked(user.id, key, true); });
        return send(progress(user.id));
      }
      if (path === '/api/admin/export' && req.method === 'GET') {
        const generatedAt = new Date(clock()).toISOString();
        const rows = transaction(() => exportRows(
          all("SELECT id,email,role,created_at,last_login,nickname,grade,target,target_major,avatar FROM users WHERE role='student' ORDER BY id"),
          all('SELECT user_id,question_key,marked_at FROM mistakes ORDER BY user_id,marked_at,question_key'),
          all('SELECT id,user_id,question_key,action,at FROM events ORDER BY user_id,at,id'), generatedAt));
        const bytes = await toWorkbook(rows);
        return send({ filename: '學生完整學習資料.xlsx', base64: Buffer.from(bytes).toString('base64'), generatedAt });
      }
      if (path === '/api/admin/stats' && req.method === 'GET') {
        const rows = all("SELECT m.* FROM mistakes m JOIN users u ON m.user_id=u.id WHERE u.role='student'");
        const students = all("SELECT id,email,role,created_at,last_login,nickname,grade,target,target_major,avatar,avatar_version FROM users WHERE role='student' ORDER BY last_login DESC").map(u => {
          const saved = rows.filter(r => r.user_id === u.id); const stats = aggregate(saved);
          return { ...u, ...publicUser(u), mistakeCount: saved.length, pointCount: stats.points.length };
        });
        return send({ students, ...aggregate(rows), summary: { students: students.length, marks: rows.length, questions: new Set(rows.map(r => r.question_key)).size, points: aggregate(rows).points.length }, activity: all("SELECT strftime('%Y-%m-%d',e.at/1000,'unixepoch','+8 hours') day,e.action,count(*) count FROM events e JOIN users u ON u.id=e.user_id WHERE u.role='student' AND e.at>? GROUP BY day,e.action ORDER BY day DESC", clock() - 30 * 86400000), generatedAt: new Date(clock()).toISOString() });
      }
      if (path === '/api/admin/student' && req.method === 'GET') {
        const student = get("SELECT id,email,role,created_at,last_login,nickname,grade,target,target_major,avatar,avatar_version FROM users WHERE id=? AND role='student'", Number(url.searchParams.get('id')) || 0);
        if (!student) fail(404, '找不到學生。');
        const rows = all('SELECT * FROM mistake_archive WHERE user_id=? ORDER BY marked_at DESC', student.id);
        const active = all('SELECT question_key,marked_at FROM mistakes WHERE user_id=?', student.id);
        const masteredRows = all('SELECT question_key,marked_at FROM mastered WHERE user_id=? ORDER BY marked_at DESC', student.id);
        return send({ student, learning: studentLearning(active, masteredRows, rows, Number(url.searchParams.get('batch')) || 0), ...aggregate(rows), mistakes: rows.map(r => ({ ...questions.get(r.question_key), status: r.status, trashedAt: r.trashed_at, deletedAt: r.deleted_at, markedAt: new Date(r.marked_at).toISOString(), knowledge: (questions.get(r.question_key)?.points || []).map(pointInfo) })) });
      }
      fail(404, '找不到此操作。');
    } catch (error) { res.statusCode = error.status || 500; send({ error: error.status ? error.message : '服務暫時無法使用，請重試。' }); if (!error.status) console.error(error); }
  }
  return { handler, hasPremium: req => { const user = session(req); return Boolean(user && (user.role === 'admin' || management.membership(user.id).active)); }, close: () => db.close(), adminKeyPath: keyPath };
}
