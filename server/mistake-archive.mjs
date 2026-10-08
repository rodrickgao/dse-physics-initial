export function createMistakeArchive({ db, clock, fail, transaction, record, questions, statusStore }) {
  const all = (sql,...args) => db.prepare(sql).all(...args);
  const get = (sql,...args) => db.prepare(sql).get(...args);
  const run = (sql,...args) => db.prepare(sql).run(...args);
  db.exec(`CREATE TABLE IF NOT EXISTS mistake_archive (
    user_id INTEGER NOT NULL REFERENCES users(id), question_key TEXT NOT NULL,
    marked_at INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','trash','deleted')),
    trashed_at INTEGER, deleted_at INTEGER, PRIMARY KEY(user_id,question_key));
    CREATE INDEX IF NOT EXISTS mistake_archive_status ON mistake_archive(user_id,status);`);
  transaction(() => {
    run("INSERT OR IGNORE INTO mistake_archive SELECT user_id,question_key,marked_at,'active',NULL,NULL FROM mistakes");
    // Old removals had no recycle bin; retain them as historical deleted records.
    run(`INSERT OR IGNORE INTO mistake_archive
      SELECT user_id,question_key,MIN(at),'deleted',MAX(at),MAX(at) FROM events
      GROUP BY user_id,question_key`);
  });
  function mark(userId,key,value) {
    if (value) run("INSERT INTO mistake_archive VALUES(?,?,?,'active',NULL,NULL) ON CONFLICT(user_id,question_key) DO UPDATE SET marked_at=excluded.marked_at,status='active',trashed_at=NULL,deleted_at=NULL",userId,key,clock());
    else run("UPDATE mistake_archive SET status='trash',trashed_at=?,deleted_at=NULL WHERE user_id=? AND question_key=?",clock(),userId,key);
  }
  function list(userId) { return all("SELECT question_key AS key,marked_at AS markedAt,trashed_at AS trashedAt FROM mistake_archive WHERE user_id=? AND status='trash' ORDER BY trashed_at DESC",userId); }
  function act(userId,body) {
    if (!['restore','delete'].includes(body.action) || !Array.isArray(body.keys) || !body.keys.length || body.keys.length>500 || body.keys.some(key=>typeof key!=='string'||!questions.has(key))) fail(400,'请选择有效的错题和操作。');
    transaction(() => {
      const before=statusStore?.snapshot(userId);
      for (const key of new Set(body.keys)) {
        const row=get('SELECT * FROM mistake_archive WHERE user_id=? AND question_key=?',userId,key);
        if (!row) fail(404,'回收站中找不到这道题。');
        if ((body.action==='restore' && row.status==='active') || (body.action==='delete' && row.status==='deleted')) continue;
        if(row.status!=='trash') fail(409,'错题状态已变化，请刷新回收站。');
        if(body.action==='restore') {
          run('DELETE FROM mastered WHERE user_id=? AND question_key=?',userId,key);
          run('INSERT INTO mistakes(user_id,question_key,marked_at) VALUES(?,?,?) ON CONFLICT(user_id,question_key) DO NOTHING',userId,key,row.marked_at);
          run("UPDATE mistake_archive SET status='active',trashed_at=NULL,deleted_at=NULL WHERE user_id=? AND question_key=?",userId,key);
        } else run("UPDATE mistake_archive SET status='deleted',deleted_at=? WHERE user_id=? AND question_key=?",clock(),userId,key);
        const event=run('INSERT INTO events(user_id,question_key,action,at) VALUES(?,?,?,?)',userId,key,body.action,clock());
        record(userId,body.action,key,`legacy-${event.lastInsertRowid}`);
      }
      if(before)statusStore.record(userId,before);
    });
  }
  return {mark,list,act};
}
