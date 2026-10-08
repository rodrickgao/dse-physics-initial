// Current state remains in the existing tables; history stores committed transitions only.
export function createQuestionStatus({db,clock}) {
 db.exec(`CREATE TABLE IF NOT EXISTS question_status_events(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),question_id TEXT NOT NULL,from_status TEXT NOT NULL,to_status TEXT NOT NULL,at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS question_status_events_user_time ON question_status_events(user_id,at);
 CREATE TABLE IF NOT EXISTS learning_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 db.prepare('INSERT OR IGNORE INTO learning_metadata VALUES(?,?)').run('status_history_since',String(clock()));
 const read=db.prepare("SELECT question_key AS question_id,'WRONG' AS status,marked_at AS updated_at FROM mistakes WHERE user_id=? UNION ALL SELECT question_key,'MASTERED',marked_at FROM mastered WHERE user_id=?");
 function snapshot(studentId) {
  const states=new Map();
  for(const row of read.all(studentId,studentId)) {const old=states.get(row.question_id);if(!old||row.updated_at>old.updated_at)states.set(row.question_id,row);}
  return states;
 }
 const insert=db.prepare('INSERT INTO question_status_events(user_id,question_id,from_status,to_status,at) VALUES(?,?,?,?,?)');
 function record(studentId,before) {
  const after=snapshot(studentId);
  for(const id of new Set([...before.keys(),...after.keys()])) {
   const previous=before.get(id)?.status||'UNMARKED',next=after.get(id)?.status||'UNMARKED';
   if(previous!==next)insert.run(studentId,id,previous,next,clock());
  }
 }
 return {snapshot,record,historySince:Number(db.prepare('SELECT value FROM learning_metadata WHERE key=?').get('status_history_since').value)};
}
