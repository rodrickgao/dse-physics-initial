import { randomUUID } from 'node:crypto';
import { databaseQueries } from './database.mjs';

const minute = 60000;
const hour = 60 * minute;
const day = 24 * hour;
const recipient = 'rodrickgao@gmail.com';
const date = value => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong' });
const escapeHtml = value => String(value).replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function securityAlertEmail(alert, origin, from) {
  const url = new URL('/admin.html', origin);
  url.hash = 'security?alert=' + alert.id;
  const { path, count, maximum, windowMs, retryAfter, ip, userAgent } = alert.evidence;
  const scope = { account: `学生 #${alert.user_id} · ${alert.email}`, guest: '未登录访客', shared: '同一来源 IP 的多账号流量' };
  const action = alert.user_id ? '审核并封号' : '查看异常记录';
  const details = [
    `触发时间（香港时间）：${date(alert.created_at)}`,
    `访问主体：${scope[alert.scope]}`,
    `触发规则：${windowMs / minute} 分钟内${alert.reason === 'distinct' ? '访问不同题目' : '请求'} ${count} 次，限额 ${maximum} 次`,
    `涉及路径：${path}`,
    `来源 IP：${ip}`,
    `客户端标识：${userAgent || '未提供'}`,
    `系统限制：HTTP 429，预计 ${retryAfter} 秒后可以重试`,
    alert.user_id ? '封号状态：待管理员审核。' : '封号状态：该告警无可封禁账号。'
  ];
  return {
    to: recipient, from, messageId: `<security-${alert.id}@ddphysics.com>`,
    subject: 'DDPhysics · 疑似批量抓取告警',
    text: [...details, '', `${action}：${url.href}`].join('\n'),
    html: `<h1>疑似批量抓取告警</h1><ul>${details.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul><p><a style="display:inline-block;padding:10px 16px;border-radius:6px;background:#235fcc;color:#fff;text-decoration:none" href="${escapeHtml(url.href)}">${action}</a></p>`
  };
}

export function createSecurityAlerts({ db, clock, fail, sendMail, from, origin }) {
  const { get, all, run, transaction } = databaseQueries(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_alerts (
      id TEXT PRIMARY KEY, bucket TEXT NOT NULL, reason TEXT NOT NULL, scope TEXT NOT NULL,
      user_id INTEGER, evidence TEXT NOT NULL, latest_evidence TEXT NOT NULL,
      created_at INTEGER NOT NULL, last_at INTEGER NOT NULL, occurrences INTEGER NOT NULL DEFAULT 1,
      decision TEXT NOT NULL DEFAULT 'pending', reviewed_at INTEGER, reviewed_by INTEGER,
      sent_at INTEGER, mail_attempt_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS security_alert_bucket ON security_alerts(bucket, reason, created_at);
    CREATE INDEX IF NOT EXISTS security_alert_dispatch ON security_alerts(decision, sent_at, next_at);
    CREATE INDEX IF NOT EXISTS security_alert_mail_attempt ON security_alerts(mail_attempt_at);
    CREATE TABLE IF NOT EXISTS security_bans (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      alert_id TEXT NOT NULL REFERENCES security_alerts(id), banned_at INTEGER NOT NULL
    );
  `);
  const select = `SELECT a.*, u.email, b.banned_at
    FROM security_alerts a LEFT JOIN users u ON u.id=a.user_id
    LEFT JOIN security_bans b ON b.user_id=a.user_id`;
  const find = id => get(`${select} WHERE a.id=?`, id);
  const publicAlert = ({ bucket, evidence, latest_evidence, next_at, mail_attempt_at, attempts, ...row }) => ({
    ...row, evidence: JSON.parse(evidence), latestEvidence: JSON.parse(latest_evidence),
    mailStatus: !sendMail ? 'disabled' : row.sent_at !== null ? 'sent'
      : row.decision !== 'pending' || row.banned_at !== null || clock() - row.created_at >= day ? 'stopped'
      : attempts > 0 ? 'retry' : 'pending'
  });
  let closed = false;
  let busy = false;
  let cleanedAt = null;

  function prune(now) {
    if (cleanedAt !== null && now - cleanedAt < hour) return;
    run("DELETE FROM security_alerts WHERE last_at<? AND decision!='banned'", now - 30 * day);
    cleanedAt = now;
  }

  async function flush() {
    if (!sendMail || busy || closed) return;
    busy = true;
    try {
      const now = clock();
      prune(now);
      const recent = get('SELECT count(*) AS n FROM security_alerts WHERE mail_attempt_at>?', now - 10 * minute).n;
      if (recent >= 6) return;
      const rows = all(`${select} WHERE a.decision='pending' AND a.sent_at IS NULL AND a.next_at<=?
        AND a.created_at>? ORDER BY a.user_id IS NULL, a.created_at LIMIT ?`, now, now - day, 6 - recent);
      for (const row of rows) {
        if (closed) break;
        const current = find(row.id);
        if (!current || current.decision !== 'pending' || current.banned_at !== null) continue;
        run('UPDATE security_alerts SET mail_attempt_at=?, attempts=attempts+1, next_at=? WHERE id=?',
          clock(), clock() + Math.min(6 * hour, 10 * minute * 2 ** Math.min(current.attempts, 6)), row.id);
        try {
          await sendMail(securityAlertEmail(publicAlert(current), origin, from));
          if (!closed) run('UPDATE security_alerts SET sent_at=? WHERE id=?', clock(), row.id);
        } catch (error) {
          console.warn('Security alert delivery failed:', error.code || 'SMTP');
        }
      }
    } catch (error) {
      if (!closed) console.error('Security alert queue failed:', error.code || 'database');
    } finally {
      busy = false;
    }
  }
  const timer = sendMail ? setInterval(() => void flush(), 30000) : null;
  timer?.unref();
  if (sendMail) queueMicrotask(() => void flush());

  function record({ bucket, reason, scope, user, evidence }) {
    const now = clock();
    try {
      prune(now);
      const sample = JSON.stringify(evidence);
      const existing = get('SELECT id,decision,last_at FROM security_alerts WHERE bucket=? AND reason=? AND created_at>? ORDER BY created_at DESC LIMIT 1',
        bucket, reason, now - hour);
      if (existing) {
        if (existing.decision === 'pending' && now - existing.last_at >= minute) {
          run('UPDATE security_alerts SET last_at=?, occurrences=occurrences+1, latest_evidence=? WHERE id=?', now, sample, existing.id);
        }
        return;
      }
      run(`INSERT INTO security_alerts(id,bucket,reason,scope,user_id,evidence,latest_evidence,created_at,last_at,next_at)
        VALUES(?,?,?,?,?,?,?,?,?,?)`, randomUUID(), bucket, reason, scope, user?.id ?? null, sample, sample, now, now, now);
      void flush();
    } catch (error) {
      console.error('Could not record security alert:', error.code || 'database');
    }
  }

  function read(id) {
    prune(clock());
    if (id === null) {
      return { rows: all(`${select} ORDER BY (a.decision='pending' AND b.banned_at IS NULL) DESC, a.last_at DESC LIMIT 50`).map(publicAlert) };
    }
    const row = find(id);
    if (!row) fail(404, '找不到这条安全告警。');
    return { rows: [publicAlert(row)] };
  }

  function review(actor, { id, action }) {
    if (typeof id !== 'string' || !['ban', 'dismiss'].includes(action)) fail(400, '告警处理参数不正确。');
    return transaction(() => {
      const row = find(id);
      if (!row) fail(404, '找不到这条安全告警。');
      const decision = action === 'ban' ? 'banned' : 'dismissed';
      if (row.decision === decision) return { alert: publicAlert(row) };
      if (row.decision !== 'pending') fail(409, '这条安全告警已处理。');
      const now = clock();
      if (action === 'ban') {
        const student = get("SELECT email FROM users WHERE id=? AND role='student'", row.user_id);
        if (!student) fail(409, '这条告警没有可封禁的学生账号。');
        if (row.banned_at !== null) fail(409, '该学生账号已经封禁。');
        run('INSERT INTO security_bans(user_id,alert_id,banned_at) VALUES(?,?,?)', row.user_id, id, now);
        run('DELETE FROM sessions WHERE user_id=?', row.user_id);
        run('DELETE FROM codes WHERE email=?', student.email);
      }
      run('UPDATE security_alerts SET decision=?, reviewed_at=?, reviewed_by=? WHERE id=?', decision, now, actor.id, id);
      return { alert: publicAlert(find(id)) };
    });
  }

  return {
    record, read, review,
    pendingCount() {
      return get(`SELECT count(*) AS n FROM security_alerts a WHERE a.decision='pending' AND a.last_at>=?
        AND NOT EXISTS (SELECT 1 FROM security_bans WHERE user_id=a.user_id)`, clock() - 30 * day).n;
    },
    isBanned(email) {
      return Boolean(get('SELECT 1 FROM security_bans b JOIN users u ON u.id=b.user_id WHERE u.email=?', email));
    },
    close() { closed = true; clearInterval(timer); }
  };
}
