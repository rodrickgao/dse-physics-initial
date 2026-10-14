import { questions } from './catalog.mjs';

export function createAdminInsights({db, clock, fail}) {
  db.exec(`CREATE TABLE IF NOT EXISTS page_visits (
    user_id INTEGER NOT NULL REFERENCES users(id), visit_id TEXT NOT NULL,
    target TEXT NOT NULL, started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL, PRIMARY KEY(user_id,visit_id));
    CREATE INDEX IF NOT EXISTS page_visits_duration ON page_visits(duration_ms,updated_at);
    CREATE TABLE IF NOT EXISTS daily_site_usage (
      user_id INTEGER NOT NULL REFERENCES users(id), day TEXT NOT NULL,
      duration_ms INTEGER NOT NULL, PRIMARY KEY(user_id,day));
    CREATE TABLE IF NOT EXISTS site_usage_metadata (key TEXT PRIMARY KEY,value INTEGER NOT NULL);`);
  db.prepare('INSERT OR IGNORE INTO site_usage_metadata VALUES(?,?)').run('since',clock());
  const usageSince=db.prepare('SELECT value FROM site_usage_metadata WHERE key=?').get('since').value;
  const dayMs=86400000, offset=8*3600000;
  const dayKey=at=>new Date(at+offset).toISOString().slice(0,10);
  function dailyUsage() {
    const first=dayKey(clock()-29*dayMs);
    return {usageSince,dailyUsage:db.prepare(`SELECT d.day,SUM(d.duration_ms) durationMs FROM daily_site_usage d JOIN users u ON u.id=d.user_id WHERE u.role='student' AND d.day>=? GROUP BY d.day ORDER BY d.day`).all(first)};
  }
  const pages = new Set(['home','support','bank','ask','papers','textbook','examples','exercises','mistakes','focus','profile','membership','payment','receipt','activating','member-success']);
  function track(user, body) {
    if (user.role !== 'student') fail(403,'仅记录学生访问。');
    const {visitId,target,durationMs} = body;
    if (typeof visitId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(visitId) || typeof target !== 'string' || target.length > 300 || !Number.isSafeInteger(durationMs) || durationMs < 0 || durationMs > 86400000) fail(400,'访问记录格式不正确。');
    const [page, query] = target.split('?');
    const params = new URLSearchParams(query);
    if (!pages.has(page) || [...params.keys()].some(k=>!['question','knowledge'].includes(k)) || (params.has('question') && !questions.has(params.get('question')))) fail(400,'页面不存在。');
    const previous = db.prepare('SELECT * FROM page_visits WHERE user_id=? AND visit_id=?').get(user.id,visitId);
    if (previous && previous.target !== target) fail(409,'访问编号已使用。');
    const now = clock();
    if (durationMs > (previous ? now-previous.started_at : 0)+15000) fail(400,'访问时长不正确。');
    // Allocate only newly reported visible time; split a heartbeat across local midnight.
    // Existing visits are the baseline, not evidence for unrecorded daily history.
    const delta=Math.max(0,durationMs-(previous?.duration_ms||0));
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`INSERT INTO page_visits VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,visit_id) DO UPDATE SET duration_ms=MAX(page_visits.duration_ms,excluded.duration_ms),updated_at=excluded.updated_at`).run(user.id,visitId,target,previous?.started_at ?? now,now,durationMs);
      for(let start=Math.max(usageSince,now-delta);start<now;) {
        const end=Math.min(now,(Math.floor((start+offset)/dayMs)+1)*dayMs-offset);
        db.prepare(`INSERT INTO daily_site_usage VALUES(?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET duration_ms=daily_site_usage.duration_ms+excluded.duration_ms`).run(user.id,dayKey(start),end-start);
        start=end;
      }
      db.exec('COMMIT');
    } catch(error) {db.exec('ROLLBACK');throw error;}
    return {ok:true};
  }
  function visits(url) {
    const number = (key,fallback) => {
      const raw=url.searchParams.get(key);if(raw===null)return fallback;
      if(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw)))fail(400,'分页参数不正确。');
      return Number(raw);
    };
    const userId = number('userId',0);
    const page = Math.max(1,Math.min(100000,number('page',1)));
    const where = "FROM page_visits v JOIN users u ON u.id=v.user_id WHERE u.role='student' AND v.duration_ms>60000 AND (?=0 OR u.id=?)";
    return {total:db.prepare(`SELECT COUNT(*) n ${where}`).get(userId,userId).n,
      rows:db.prepare(`SELECT v.*,u.nickname,u.email ${where} ORDER BY v.updated_at DESC LIMIT 50 OFFSET ?`).all(userId,userId,(page-1)*50)};
  }
  function questionStats() {
    const counts = table => new Map(db.prepare(`SELECT question_key,COUNT(DISTINCT user_id) n FROM ${table} WHERE user_id IN (SELECT id FROM users WHERE role='student') GROUP BY question_key`).all().map(r=>[r.question_key,r.n]));
    const active=counts('mistakes'), mastered=counts('mastered');
    const marked=new Map(db.prepare(`SELECT question_key,COUNT(DISTINCT user_id) n FROM (SELECT user_id,question_key FROM mistake_archive UNION SELECT user_id,question_key FROM mistakes) WHERE user_id IN (SELECT id FROM users WHERE role='student') GROUP BY question_key`).all().map(r=>[r.question_key,r.n]));
    const keys=new Set([...questions.keys(),...marked.keys(),...mastered.keys()]);
    return {rows:[...keys].map(key=>({...questions.get(key),key,label:questions.get(key)?.label || key,marked:marked.get(key)||0,active:active.get(key)||0,mastered:mastered.get(key)||0}))};
  }
  return {track,visits,questionStats,dailyUsage};
}
