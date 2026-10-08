// Per minute; account limits allow normal reading and a 30-question print batch.
export const CONTENT_LIMITS = Object.freeze({ detail: 90, search: 40, links: 120, similar: 30, download: 12, image: 600, directory: 60 });
export function createContentLimiter({ db, clock = Date.now, config = {} }) {
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
  let cleaned = 0;
  return (req, res, user, kind) => {
    const now = clock(), ip = req.contentClientIp || req.socket.remoteAddress || 'unknown';
    if (now - cleaned > 3600000) { db.prepare('DELETE FROM content_limits WHERE start<? AND blocked_until<?').run(now - 86400000, now); db.prepare('DELETE FROM content_reads WHERE at<?').run(now-3600000); cleaned = now; }
    if (kind === 'detail') {
      const bucket = user ? `u:${user.id}` : `guest:${ip}`;
      const id = new URL(req.url,'http://localhost').searchParams.get('id') || '';
      const seen = db.prepare('SELECT at FROM content_reads WHERE bucket=? AND id=?').get(bucket,id);
      if ((!seen || seen.at <= now-3600000) && db.prepare('SELECT count(*) n FROM content_reads WHERE bucket=? AND at>?').get(bucket,now-3600000).n >= hourlyDistinct) {
        const oldest = db.prepare('SELECT min(at) oldest FROM content_reads WHERE bucket=? AND at>?').get(bucket,now-3600000).oldest;
        res.setHeader('Retry-After',Math.max(1,Math.ceil((oldest+3600000-now)/1000))); throw Object.assign(new Error('本小时读取新题较多，请稍后继续。'),{status:429});
      }
      db.prepare('INSERT OR REPLACE INTO content_reads VALUES(?,?,?)').run(bucket,id,now);
    }
    // Never trust X-Forwarded-For from a browser. Configure the reverse proxy before deployment.
    const buckets = user ? [[`u:${user.id}:${kind}`, thresholds[kind]], [`ip:${ip}:${kind}`, thresholds[kind] * 40]] : [[`guest:${ip}:${kind}`, thresholds[kind]]];
    for (const [bucket, maximum] of buckets) {
      let row = read.get(bucket) || { start: now, count: 0, strikes: 0, blocked_until: 0 };
      if (row.blocked_until > now) { res.setHeader('Retry-After', Math.ceil((row.blocked_until-now)/1000)); throw Object.assign(new Error('请求过于频繁，请稍后重试。'), {status:429}); }
      if (now-row.start >= 60000) row = { ...row, start: now, count: 0, strikes: now-row.start > 3600000 ? 0 : row.strikes };
      row.count++;
      if (row.count > maximum) { row.strikes++; row.blocked_until = now + Math.min(900000, 30000 * 2 ** Math.min(row.strikes-1, 5)); }
      put.run(bucket, row.start, row.count, row.strikes, row.blocked_until);
      if (row.blocked_until > now) { res.setHeader('Retry-After', Math.ceil((row.blocked_until-now)/1000)); throw Object.assign(new Error('请求过于频繁，请稍后重试。'), {status:429}); }
    }
  };
}
