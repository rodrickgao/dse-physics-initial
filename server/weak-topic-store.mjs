// Reading and dismissing a card never changes the student's question marks.
export function createWeakTopicStore({db,topics,cardFor,questionCards}) {
 db.exec(`CREATE TABLE IF NOT EXISTS weak_topic_reviews(
  user_id INTEGER NOT NULL REFERENCES users(id), card_id TEXT NOT NULL,
  viewed_revision INTEGER NOT NULL DEFAULT -1, dismissed_revision INTEGER NOT NULL DEFAULT -1,
  PRIMARY KEY(user_id,card_id));
  CREATE INDEX IF NOT EXISTS events_user_action ON events(user_id,action,id);`);
 const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
 function rows(userId,language) {
  const revisions=new Map();
  // Event IDs also distinguish repeated mistakes recorded in the same millisecond.
  for(const event of db.prepare("SELECT id,question_key FROM events WHERE user_id=? AND action='mark' ORDER BY id").all(userId))
   for(const key of questionCards.get(event.question_key)||[])revisions.set(key,event.id);
  const saved=new Map(db.prepare('SELECT * FROM weak_topic_reviews WHERE user_id=?').all(userId).map(r=>[r.card_id,r]));
  return topics(userId,language).map(p=>{
   const key=cardFor.get(String(p.knowledge_id)),revision=revisions.get(key)||0,review=saved.get(key);
   return {knowledge_id:p.knowledge_id,topic_key:key,name:p.name,number:p.number,chapter:p.chapter,
    revision,can_dismiss:(review?.viewed_revision??-1)>=revision,hidden:(review?.dismissed_revision??-1)>=revision};
  });
 }
 function list(userId,language='chn'){return {weak_points:rows(userId,language).filter(p=>!p.hidden).map(({hidden,...p})=>p)};}
 function update(userId,{knowledge_id,revision},action,language='chn') {
  db.exec('BEGIN IMMEDIATE');
  try {
   const key=cardFor.get(String(knowledge_id));
   if(!key)fail(404,'找不到知识点。');
   const p=rows(userId,language).find(p=>p.topic_key===key);
   if(!p||p.hidden||p.revision!==revision)fail(409,'薄弱知识点已更新，请返回主页刷新。');
   if(action==='dismiss'&&!p.can_dismiss)fail(409,'请先打开这个知识点查看。');
   const field=action==='viewed'?'viewed_revision':'dismissed_revision';
   db.prepare(`INSERT INTO weak_topic_reviews(user_id,card_id,${field}) VALUES(?,?,?)
    ON CONFLICT(user_id,card_id) DO UPDATE SET ${field}=excluded.${field}`).run(userId,key,revision);
   const result=list(userId,language);db.exec('COMMIT');return result;
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 return {list,update};
}
