import { isIP } from 'node:net';

// Per minute; account limits allow normal reading and a 30-question print batch.
export const CONTENT_LIMITS = Object.freeze({ detail: 90, search: 40, links: 120, similar: 30, download: 12, image: 600, directory: 60, knowledge: 120 });
export function createContentLimiter({ db, clock = Date.now, config = {}, onLimit }) {
  const thresholds = Object.fromEntries(Object.entries(CONTENT_LIMITS).map(([key, value]) => {
    const n = Number(config[key] ?? process.env[`DSE_LIMIT_${key.toUpperCase()}`] ?? value);
    if (!Number.isInteger(n) || n < 1 || n > 100000) throw new Error(`Invalid content limit: ${key}`);
    return [key, n];
  }));
  db.exec('CREATE TABLE IF NOT EXISTS content_limits(bucket TEXT PRIMARY KEY, start INTEGER, count INTEGER, strikes INTEGER, blocked_until INTEGER)');
  db.exec('CREATE TABLE IF NOT EXISTS content_reads(bucket TEXT, id TEXT, at INTEGER, PRIMARY KEY(bucket,id)); CREATE INDEX IF NOT EXISTS content_reads_at ON content_reads(at)');
  const hourlyDistinct = Number(config.distinctHour ?? process.env.DSE_LIMIT_DISTINCT_HOUR ?? 300);
  if (!Number.isInteger(hourlyDistinct) || hourlyDistinct < 1) throw new Error('Invalid content limit: distinctHour');
  const read = db.prepare('SELECT * FROM content_limits WHERE bucket=?');
  const put = db.prepare('INSERT OR REPLACE INTO content_limits VALUES(?,?,?,?,?)');
  const readQuestion = db.prepare('SELECT at FROM content_reads WHERE bucket=? AND id=?');
  const readWindow = db.prepare('SELECT count(*) n, min(at) oldest FROM content_reads WHERE bucket=? AND at>?');
  const putQuestion = db.prepare('INSERT OR REPLACE INTO content_reads VALUES(?,?,?)');
  let cleaned = 0;
  return (req, res, user, kind) => {
    const now = clock();
    const ip = isIP(req.contentClientIp || '') ? req.contentClientIp : req.socket.remoteAddress || 'unknown';
    const identity = user ? `u:${user.id}` : `guest:${ip}`;
    let url;
    function blocked({ bucket, scope, reason, count, maximum, windowMs, until, message, record }) {
      const retryAfter = Math.max(1, Math.ceil((until - now) / 1000));
      res.setHeader('Retry-After', retryAfter);
      if (record && onLimit && user?.role !== 'admin') {
        url ??= new URL(req.url, 'http://localhost');
        onLimit({
          bucket, scope, reason, user: scope === 'account' ? user : null,
          evidence: {
            path: url.pathname.slice(0, 240), kind, count, maximum, windowMs, retryAfter, ip,
            userAgent: String(req.headers?.['user-agent'] || '').replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 240)
          }
        });
      }
      throw Object.assign(new Error(message), { status: 429 });
    }
    if (now - cleaned > 3600000) { db.prepare('DELETE FROM content_limits WHERE start<? AND blocked_until<?').run(now - 86400000, now); db.prepare('DELETE FROM content_reads WHERE at<?').run(now-3600000); cleaned = now; }
    let questionId;
    if (kind === 'detail') {
      url = new URL(req.url, 'http://localhost');
      questionId = url.searchParams.get('id');
      if (questionId) {
        const seen = readQuestion.get(identity, questionId);
        if (!seen || seen.at <= now - 3600000) {
          const { n, oldest } = readWindow.get(identity, now - 3600000);
          if (n >= hourlyDistinct) blocked({
            bucket: identity, scope: user ? 'account' : 'guest', reason: 'distinct',
            count: n + 1, maximum: hourlyDistinct, windowMs: 3600000, until: oldest + 3600000,
            message: '本小时读取新题较多，请稍后继续。', record: true
          });
        }
      }
    }
    // The HTTP entry point resolves the client address when a trusted proxy is configured.
    const buckets = [[`${identity}:${kind}`, thresholds[kind], user ? 'account' : 'guest']];
    if (user) buckets.push([`ip:${ip}:${kind}`, thresholds[kind] * 40, 'shared']);
    for (const [bucket, maximum, scope] of buckets) {
      const reject = (row, record) => blocked({
        bucket, scope, reason: 'rate', count: row.count, maximum, windowMs: 60000, until: row.blocked_until,
        message: '请求过于频繁，请稍后重试。', record
      });
      let row = read.get(bucket) || { start: now, count: 0, strikes: 0, blocked_until: 0 };
      if (row.blocked_until > now) reject(row, false);
      if (now-row.start >= 60000) row = { ...row, start: now, count: 0, strikes: now-row.start > 3600000 ? 0 : row.strikes };
      row.count++;
      if (row.count > maximum) { row.strikes++; row.blocked_until = now + Math.min(900000, 30000 * 2 ** Math.min(row.strikes-1, 5)); }
      put.run(bucket, row.start, row.count, row.strikes, row.blocked_until);
      if (row.blocked_until > now) reject(row, true);
    }
    if (questionId) putQuestion.run(identity, questionId, now);
  };
}
