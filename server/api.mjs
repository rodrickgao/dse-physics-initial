import { createProgressStore } from './progress-store.mjs';
import { createAdminReports } from './admin-reports.mjs';
import { questionStatsWorkbook } from './question-stats-export.mjs';
import { createWeeklyReportScheduler } from './weekly-report-scheduler.mjs';
import { createPaymentNotifications } from './payment-notifications.mjs';
import { createAdminInsights } from './admin-insights.mjs';
import {studentLearningView,memberWeeklyReport} from './qdna-learning.mjs';
import { createQuestionStatus } from './question-status.mjs';
import { createQdnaLearning } from './qdna-learning.mjs';
import { createContentLimiter } from './content-limits.mjs';
import { weeklyReportEmail } from './weekly-report-email.mjs';
import { createContent } from './content.mjs';
import { createTutoring } from './tutoring.mjs';
import { openDatabase, databaseQueries } from './database.mjs';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { questions } from './catalog.mjs';
import { publicProfile, validateProfile } from './profile.mjs';
import { encodePassword, checkPassword } from './password.mjs';
import { createManagement } from './management.mjs';
import { createMistakeArchive } from './mistake-archive.mjs';
import { createPaymentOrders } from './payment-orders.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const publicUser = publicProfile;

export function createApi({ directory, mailer, paymentNotifier, weeklyMailer, weeklyFrom, clock = Date.now, adminKey: suppliedKey, publicOrigins = [], secureCookies = false, trustProxy = false, contentLimits, qdnaDirectory = process.env.DSE_QDNA_DIR } = {}) {
  const allowedOrigins = new Set(publicOrigins);
  const allowedHosts = new Set(publicOrigins.map(value => new URL(value).host));
  if (secureCookies && (!mailer || !allowedOrigins.size)) throw new Error('Production requires email delivery and an explicit HTTPS origin.');
  mkdirSync(directory, { recursive: true });
  const keyPath = join(directory, 'admin-key.txt');
  if (!suppliedKey && !existsSync(keyPath)) writeFileSync(keyPath, token(), { mode: 0o600 });
  const adminKey = suppliedKey || readFileSync(keyPath, 'utf8').trim();
  const db = openDatabase(directory);
  const { get, all, run, transaction } = databaseQueries(db);
  const insights = createAdminInsights({db,clock,fail});
  const management = createManagement({ db, clock, fail, transaction });
  const content = createContent({ db, clock, secret: adminKey, membership: management.membership, limiterConfig: contentLimits, qdnaDirectory });
  const statusStore = createQuestionStatus({db,clock});
  const learning = createQdnaLearning({db,clock,statusStore});
  content.setLearning(learning);
  const weeklyForStudent=(id,options)=>memberWeeklyReport(learning.weekly(id,options),management.membership(id).active);
  const weeklyReports=createWeeklyReportScheduler({db,clock,buildReport:weeklyForStudent,prepareReport:(id,report)=>memberWeeklyReport(report,management.membership(id).active),sendMail:weeklyMailer,from:weeklyFrom});
  const learningLimit=createContentLimiter({db,clock,config:contentLimits});
  const archive = createMistakeArchive({ db, clock, fail, transaction, record: management.record, questions, statusStore });
  const tutoring = createTutoring({ db, clock, fail });
  const progress = createProgressStore({ db, clock, fail, archive, management, statusStore, token });
  const reports = createAdminReports({ db, clock, fail, management, learning });
  const paymentNotifications = createPaymentNotifications({db,clock,sendMail:paymentNotifier});
  const payments = createPaymentOrders({ db, clock, fail, transaction, management, notifications:paymentNotifications });
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
  async function handler(req, res, next) {
    req.contentClientIp = (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',').at(-1).trim()) || req.socket.remoteAddress;
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
      if (content.handle(req,res,url,session(req) || session(req,true))) return;
      const ip = req.contentClientIp;
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
      if (path.startsWith('/api/learning/') || path.startsWith('/api/admin/learning/')) {
        if(req.method!=='GET')fail(405,'只支持 GET。');
        const admin=path.startsWith('/api/admin/'),kind=path.split('/').at(-1);
        const allowed=kind==='dashboard'?['language','offset','limit','studentId']:kind==='knowledge'?['language','id','status','offset','limit','studentId']:kind==='weekly'?['language','studentId','start','end']:['language','type','offset','limit'];
        for(const key of url.searchParams.keys())if(!allowed.includes(key)||url.searchParams.getAll(key).length!==1||(!admin&&key==='studentId'))fail(400,'请求参数不正确。');
        const language=url.searchParams.get('language')||'chn';if(!['chn','eng'].includes(language))fail(400,'语言不正确。');
        const number=(key,fallback,max)=>{const value=url.searchParams.get(key);if(value===null)return fallback;if(!/^\d+$/.test(value)||Number(value)>max)fail(400,'分页参数不正确。');return Number(value);};
        const offset=number('offset',0,10000),size=number('limit',20,50);if(size<1)fail(400,'分页参数不正确。');
        const studentId=admin?number('studentId',0,Number.MAX_SAFE_INTEGER):user.id;
        if(admin&&kind!=='overview'&&!get("SELECT id FROM users WHERE id=? AND role='student'",studentId))fail(404,'找不到学生。');
        learningLimit(req,res,user,'similar');res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie');
        const recommendationAccess=admin||management.membership(user.id).active;
        if(kind==='dashboard'){const result=learning.dashboard(studentId,{language,offset,limit:size});return send(admin?result:studentLearningView(result,{recommendationAccess}));}
        if(kind==='knowledge'){const status=url.searchParams.get('status')||'ALL';if(!['ALL','MASTERED','WRONG','UNMARKED'].includes(status))fail(400,'状态不正确。');const result=learning.knowledge(studentId,url.searchParams.get('id'),{language,status,offset,limit:size});if(!result)fail(404,'找不到知识点。');return send(admin?result:studentLearningView(result,{recommendationAccess}));}
        if(admin&&kind==='overview'){const type=url.searchParams.get('type')||'questions';if(!['questions','knowledge'].includes(type))fail(400,'统计类型不正确。');return send(learning.adminOverview({language,type,offset,limit:size}));}
        if(admin&&kind==='weekly'){const end=number('end',clock(),clock()),start=number('start',end-7*86400000,end);if(start>=end||end-start>31*86400000)fail(400,'周报时间范围不正确。');const report=weeklyForStudent(studentId,{language,start,end});const email=await weeklyReportEmail({from:'preview@local.invalid',to:'preview@local.invalid',report});return send({report,email:{subject:email.subject,html:email.html,text:email.text}});}
        fail(404,'找不到此操作。');
      }
      if (path === '/api/admin/content/dna'  && req.method === 'GET') return send(content.adminDna(url));
      if (path === '/api/admin/session' && req.method === 'GET') return send({ user: publicUser(user) });
      if (path === '/api/membership' && req.method === 'GET') return send({ membership: management.membership(user.id), accessMode: 'links-reasoning-tutoring' });
      if (path === '/api/premium/network' && req.method === 'GET') {
        if (user.role !== 'admin' && !management.membership(user.id).active) fail(403, '知識點關聯需要有效會員。');
        fail(410, '请使用按题目或知识点分页的内容接口。');
      }
      if (path === '/api/admin/tutoring' && req.method === 'GET') return send({ rows:tutoring.list() });
      if (path === '/api/admin/tutoring/reply' && req.method === 'POST') return send(tutoring.reply(user,body));
      if (path === '/api/page-visits' && req.method === 'POST') return send(insights.track(user,body));
      if (path === '/api/admin/page-visits' && req.method === 'GET') return send(insights.visits(url));
      if (path === '/api/admin/question-stats' && req.method === 'GET') return send(insights.questionStats());
      if (path === '/api/admin/question-stats/export' && req.method === 'GET') {
        for (const key of url.searchParams.keys()) if (key !== 'language' || url.searchParams.getAll(key).length !== 1) fail(400, '请求参数不正确。');
        const language = url.searchParams.get('language') || 'chn';
        if (!['chn', 'eng'].includes(language)) fail(400, '语言不正确。');
        return send(await questionStatsWorkbook(insights.questionStats().rows, new Date(clock()).toISOString(), language));
      }
      if (path === '/api/admin/weekly-status' && req.method === 'GET') return send(weeklyReports.status());
      if (path === '/api/admin/overview' && req.method === 'GET') return send({...management.overview(),...insights.dailyUsage()});
      if (path === '/api/admin/activity' && req.method === 'GET') return send(management.activity(url));
      if (path === '/api/admin/membership-history' && req.method === 'GET') return send({ rows: management.history(Number(url.searchParams.get('userId')) || 0) });
      if (path === '/api/admin/membership' && req.method === 'POST') return send(management.change(user, body));
      if (path === '/api/orders' && req.method === 'GET') return send({order:payments.latest(user.id)});
      if (path === '/api/admin/orders' && req.method === 'GET') return send(payments.list());
      if (path === '/api/admin/orders/receipt' && req.method === 'GET') { const image = payments.receipt(url.searchParams.get('id')); res.setHeader('Content-Type','image/webp'); return res.end(image); }
      if (path === '/api/admin/orders/review' && req.method === 'POST') { const result=payments.review(user,body); void paymentNotifications.flush(); return send(result); }
      if (path === '/api/profile' && req.method === 'PUT') {
        if (user.role !== 'student') fail(403, '此功能供學生使用。');
        limit(`profile:${user.id}`, 30, 60000);
        const profile = await validateProfile(body, user);
        let passwordHash = null;
        if (!user.password_hash && (!publicUser(user).profileComplete || body.password || body.confirmPassword)) passwordHash = await encodePassword(body.password, body.confirmPassword);
        if (user.password_hash && (body.password || body.confirmPassword)) fail(400, '此帳號已設定密碼。');
        transaction(() => {
          run('UPDATE users SET nickname=?,grade=?,region=?,target=?,target_major=?,avatar=?,avatar_data=?,avatar_version=? WHERE id=?', profile.nickname, profile.grade, profile.region, profile.target, profile.targetMajor, profile.avatar, profile.bytes, token().slice(0,16), user.id);
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
        const result=await payments.submit(user,body); void paymentNotifications.flush(); return send(result);
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
      if (path === '/api/progress/undo' && req.method === 'POST') return send(progress.undo(user.id, body));
      if (path === '/api/progress' && req.method === 'PUT') return send(progress.update(user.id, body));
      if (path === '/api/mistakes' && req.method === 'GET') return send(progress.read(user.id));
      if (path === '/api/mistakes/trash' && req.method === 'GET') return send({ trash: progress.listTrash(user.id) });
      if (path === '/api/mistakes/trash' && req.method === 'POST') return send(progress.trash(user.id, body));
      if (path === '/api/mistakes' && req.method === 'PUT') return send(progress.setMistake(user.id, body));
      if (path === '/api/mistakes/import' && req.method === 'POST') return send(progress.importMistakes(user.id, body));
      if (path === '/api/admin/export' && req.method === 'GET') return send(await reports.exportWorkbook());
      if (path === '/api/admin/stats' && req.method === 'GET') return send(reports.stats());
      if (path === '/api/admin/student' && req.method === 'GET') return send(reports.student(url));
      fail(404, '找不到此操作。');
    } catch (error) { res.statusCode = error.status || 500; send({ error: error.status ? error.message : '服務暫時無法使用，請重試。' }); if (!error.status) console.error('API request failed', {path:req.url.split('?')[0],type:error.name}); }
  }
  return { handler, buildWeeklyReport: weeklyForStudent, protectFiles: (req,res) => content.file(req,res,session(req) || session(req,true)), hasPremium: req => { const user = session(req); return Boolean(user && (user.role === 'admin' || management.membership(user.id).active)); }, close: () => { weeklyReports.close(); paymentNotifications.close(); db.close(); }, adminKeyPath: keyPath };
}
