import { questions, points, pointInfo } from './catalog.mjs';

export function activityContent(row) {
  if (row.action === 'knowledge_view' && points.has(Number(row.target))) {
    const point = pointInfo(Number(row.target));
    return {label:`${point.number} · ${point.title}`,labelEn:`${point.number} · ${point.titleEn || point.title}`,href:`/#textbook?knowledge=${point.sequence}`};
  }
  const question = ['question_view','answer_view','reasoning_view','mark','unmark','restore','delete'].includes(row.action) && questions.get(row.target);
  if (question) return {label:question.label,labelEn:question.labelEn || question.label,href:`/#${question.source==='textbook'?'exercises':'papers'}?question=${encodeURIComponent(question.key)}`};
  return null;
}

const DAY = 86400000;
export function createManagement({ db, clock, fail, transaction }) {
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  db.exec(`CREATE TABLE IF NOT EXISTS memberships(user_id INTEGER PRIMARY KEY REFERENCES users(id), ends_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS membership_audit(id INTEGER PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id), actor_id INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL, days INTEGER NOT NULL, reason TEXT NOT NULL, before_end INTEGER, after_end INTEGER, at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS learning_activity(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), event_id TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, at INTEGER NOT NULL, UNIQUE(user_id,event_id));
    CREATE INDEX IF NOT EXISTS learning_activity_time ON learning_activity(at);
    CREATE INDEX IF NOT EXISTS learning_activity_user ON learning_activity(user_id,at);
    CREATE INDEX IF NOT EXISTS membership_audit_user ON membership_audit(user_id,at);`);
  function membership(id) {
    const row = get('SELECT * FROM memberships WHERE user_id=?', id);
    const active = Boolean(row && !row.revoked && row.ends_at > clock());
    return { active, status: !row ? 'none' : row.revoked ? 'revoked' : active ? 'active' : 'expired', endsAt: row?.ends_at || null, revision: row?.revision || 0 };
  }
  function record(userId, action, target = '', eventId = null) {
    run('INSERT OR IGNORE INTO learning_activity(user_id,event_id,action,target,at) VALUES(?,?,?,?,?)', userId, eventId || crypto.randomUUID(), action, target, clock());
  }
  const allowed = new Set(['page_view', 'question_view', 'answer_view', 'reasoning_view', 'knowledge_view', 'search', 'download', 'focus_start', 'focus_pause', 'focus_reset']);
  function track(user, body) {
    if (user.role !== 'student') fail(403, '僅記錄學生操作。');
    if (!allowed.has(body.action) || typeof body.eventId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.eventId) || typeof body.target !== 'string' || body.target.length > 160) fail(400, '操作記錄格式不正確。');
    if (body.action === 'reasoning_view' && !membership(user.id).active) fail(403, '詳細思路需要有效會員。');
    if (['question_view', 'answer_view', 'reasoning_view'].includes(body.action) && !questions.has(body.target)) fail(400, '題目不存在。');
    if (body.action === 'knowledge_view' && !points.has(Number(body.target))) fail(400, '知識點不存在。');
    if (body.action === 'page_view' && !['home','bank','ask','papers','textbook','exercises','mistakes','focus','profile','membership','payment','receipt','activating','member-success'].includes(body.target)) fail(400, '頁面不存在。');
    record(user.id, body.action, body.target, body.eventId);
    return { ok: true };
  }
  function change(user, body) {
    const id = Number(body.userId);
    if (!Number.isSafeInteger(id) || !get("SELECT id FROM users WHERE id=? AND role='student'", id)) fail(404, '找不到學生。');
    if (!['extend', 'revoke'].includes(body.action) || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 300 || typeof body.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.requestId)) fail(400, '請填寫有效的操作及原因。');
    const days = body.action === 'extend' ? Number(body.days) : 0;
    if (body.action === 'extend' && (!Number.isInteger(days) || days < 1 || days > 3650)) fail(400, '會員天數須為 1–3650 的整數。');
    return transaction(() => {
      const previous = get('SELECT * FROM membership_audit WHERE request_id=?', body.requestId);
      if (previous) {
        if (previous.user_id !== id || previous.action !== body.action || previous.days !== days || previous.reason !== body.reason.trim()) fail(409, '操作編號已使用，請重新確認。');
        return { membership: membership(id), duplicate: true };
      }
      const before = membership(id);
      if (body.revision !== before.revision) fail(409, '會員資料已變更，請重新整理後操作。');
      const end = body.action === 'extend' ? Math.max(clock(), before.active ? before.endsAt : 0) + days * DAY : before.endsAt || clock();
      run('INSERT INTO memberships VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET ends_at=excluded.ends_at,revoked=excluded.revoked,revision=excluded.revision', id, end, body.action === 'revoke' ? 1 : 0, before.revision + 1);
      run('INSERT INTO membership_audit(request_id,user_id,actor_id,action,days,reason,before_end,after_end,at) VALUES(?,?,?,?,?,?,?,?,?)', body.requestId, id, user.id, body.action, days, body.reason.trim(), before.endsAt, end, clock());
      return { membership: membership(id) };
    });
  }
  const safeStudent = "SELECT id,email,nickname,grade,target,created_at,last_login FROM users WHERE role='student'";
  function overview() {
    const now = clock();
    const students = all(safeStudent + ' ORDER BY last_login DESC').map(u => ({ ...u, membership: membership(u.id), lastActivity: get('SELECT MAX(at) at FROM learning_activity WHERE user_id=?', u.id)?.at || null, operations: get('SELECT COUNT(*) n FROM learning_activity WHERE user_id=?', u.id).n, focusMinutes: Math.round(get('SELECT COALESCE(SUM(elapsed_ms),0) n FROM focus_sessions WHERE user_id=?', u.id).n / 60000), mistakes: get('SELECT COUNT(*) n FROM mistake_archive WHERE user_id=?', u.id).n, activeMistakes: get('SELECT COUNT(*) n FROM mistakes WHERE user_id=?', u.id).n, mastered: get('SELECT COUNT(*) n FROM mastered WHERE user_id=?', u.id).n }));
    return { students, summary: { students: students.length, members: students.filter(s => s.membership.active).length, expiring: students.filter(s => s.membership.active && s.membership.endsAt <= now + 7 * DAY).length, active: get("SELECT COUNT(DISTINCT a.user_id) n FROM learning_activity a JOIN users u ON u.id=a.user_id WHERE u.role='student' AND a.at>=?", now - 7 * DAY).n, operations: get('SELECT COUNT(*) n FROM learning_activity WHERE at>=?', now - DAY).n, focusMinutes: students.reduce((sum, s) => sum + s.focusMinutes, 0) }, daily: all("SELECT strftime('%Y-%m-%d',at/1000,'unixepoch','+8 hours') day,COUNT(*) operations,COUNT(DISTINCT user_id) students FROM learning_activity WHERE at>=? GROUP BY day ORDER BY day DESC", now - 30 * DAY), generatedAt: now };
  }
  function activity(url) {
    const id = Number(url.searchParams.get('userId')) || 0;
    const action = url.searchParams.get('action') || '';
    const page = Math.max(1, Math.min(100000, Number(url.searchParams.get('page')) || 1));
    const where = "WHERE u.role='student' AND (?=0 OR a.user_id=?) AND (?='' OR a.action=?)";
    const args = [id, id, action, action];
    return { page, total: get(`SELECT COUNT(*) n FROM learning_activity a JOIN users u ON u.id=a.user_id ${where}`, ...args).n, rows: all(`SELECT a.*,u.email,u.nickname FROM learning_activity a JOIN users u ON u.id=a.user_id ${where} ORDER BY a.id DESC LIMIT 50 OFFSET ?`, ...args, (Math.floor(page) - 1) * 50).map(r => ({ ...r, label: questions.get(r.target)?.label || r.target, content: activityContent(r) })) };
  }
  function history(id = 0) { return all('SELECT a.*,u.nickname,u.email FROM membership_audit a JOIN users u ON u.id=a.user_id WHERE (?=0 OR a.user_id=?) ORDER BY a.id DESC LIMIT 200', id, id); }
  // Import only historical operations that were actually recorded by the old site.
  run("INSERT OR IGNORE INTO learning_activity(user_id,event_id,action,target,at) SELECT e.user_id,'legacy-'||e.id,e.action,e.question_key,e.at FROM events e JOIN users u ON u.id=e.user_id WHERE u.role='student'");
  return { membership, record, track, change, overview, activity, history };
}
