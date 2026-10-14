import { databaseQueries } from './database.mjs';
import { questions } from './catalog.mjs';

// A single owner for marking, mastery, archive updates and undo snapshots.
export function createProgressStore({ db, clock, fail, archive, management, statusStore, token }) {
  const { get, all, run, transaction } = databaseQueries(db);
  const mastered = userId => Object.fromEntries(all('SELECT question_key,marked_at FROM mastered WHERE user_id=?',userId).map(r => [r.question_key,{markedAt:new Date(r.marked_at).toISOString()}]));
  const progress = userId => ({ mistakes:marked(userId), mastered:mastered(userId) });
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
  const progressSnapshot = (userId, keys) => keys.map(key => ({key,
    mistake:get('SELECT marked_at FROM mistakes WHERE user_id=? AND question_key=?',userId,key)?.marked_at ?? null,
    mastered:get('SELECT marked_at FROM mastered WHERE user_id=? AND question_key=?',userId,key)?.marked_at ?? null,
    archive:get('SELECT marked_at,status,trashed_at,deleted_at FROM mistake_archive WHERE user_id=? AND question_key=?',userId,key) || null
      }));

  function undo(userId, body) {
    const undo=get('SELECT * FROM progress_undo WHERE id=? AND user_id=?',String(body.id||''),userId);
    if(!undo || clock()-undo.created_at>600000) fail(409,'撤销已过期，请重新调整学习状态。');
    const snapshot=JSON.parse(undo.snapshot),keys=snapshot.map(row=>row.key);
    transaction(()=>{
      const before=statusStore.snapshot(userId);
      if(JSON.stringify(progressSnapshot(userId, keys))!==undo.after_state) fail(409,'这些题目的状态已再次改变，请刷新后查看。');
      for(const row of snapshot){
        for(const table of ['mistakes','mastered','mistake_archive']) run(`DELETE FROM ${table} WHERE user_id=? AND question_key=?`,userId,row.key);
        if(row.mistake!==null) run('INSERT INTO mistakes VALUES(?,?,?)',userId,row.key,row.mistake);
        if(row.mastered!==null) run('INSERT INTO mastered VALUES(?,?,?)',userId,row.key,row.mastered);
        if(row.archive) run('INSERT INTO mistake_archive VALUES(?,?,?,?,?,?)',userId,row.key,row.archive.marked_at,row.archive.status,row.archive.trashed_at,row.archive.deleted_at);
      }
      run('DELETE FROM progress_undo WHERE id=?',undo.id);
      statusStore.record(userId,before);
    });
    return progress(userId);
  }
  function update(userId, body) {
    if (!Array.isArray(body.keys) || !body.keys.length || body.keys.length>questions.size || body.keys.some(k=>!questions.has(k)) || !['mastered','mistake','clear'].includes(body.status)) fail(400,'请选择有效的题目和学习状态。');
    const undoId=token(), keys=[...new Set(body.keys)];
    transaction(() => { const before=statusStore.snapshot(userId); const snapshot=progressSnapshot(userId, keys); for (const key of keys) {
      setMarked(userId,key,body.status==='mistake');
      if(body.status==='mastered') run('INSERT INTO mastered VALUES(?,?,?) ON CONFLICT(user_id,question_key) DO UPDATE SET marked_at=excluded.marked_at',userId,key,clock());
      else run('DELETE FROM mastered WHERE user_id=? AND question_key=?',userId,key);
    }
      run('DELETE FROM progress_undo WHERE created_at<?',clock()-600000);
      run('INSERT INTO progress_undo VALUES(?,?,?,?,?)',undoId,userId,JSON.stringify(snapshot),JSON.stringify(progressSnapshot(userId, keys)),clock());
      statusStore.record(userId,before);
    });
    return {...progress(userId),undoId};
  }
  function setMistake(userId, body) {
    if (typeof body.marked !== 'boolean' || typeof body.key !== 'string') fail(400, '錯題格式不正確。');
    transaction(() => {const before=statusStore.snapshot(userId);setMarked(userId, body.key, body.marked);statusStore.record(userId,before);}); return progress(userId);
  }
  function importMistakes(userId, body) {
    if (!Array.isArray(body.keys) || body.keys.length > questions.size || body.keys.some(k => !questions.has(k))) fail(400, '匯入的題目資料不正確。');
    transaction(() => {const before=statusStore.snapshot(userId); for (const key of new Set(body.keys)) setMarked(userId, key, true);statusStore.record(userId,before); });
    return progress(userId);
  }
  function trash(userId, body) {
    if (body.action === 'trash') {
      transaction(() => {
        const keys = body.all === true ? all('SELECT question_key FROM mistakes WHERE user_id=?', userId).map(row => row.question_key) : body.keys;
        if (body.all === true && (!Number.isSafeInteger(body.expectedCount) || body.expectedCount < 1 || body.expectedCount > questions.size)) fail(400, '请选择有效的错题。');
        if (body.all === true && keys.length !== body.expectedCount) fail(409, '错题数量已变化，请重新确认全部删除。');
        if (!Array.isArray(keys) || !keys.length || keys.length > questions.size || keys.some(key => !questions.has(key))) fail(400, '请选择有效的错题。');
        const before = statusStore.snapshot(userId);
        for (const key of new Set(keys)) setMarked(userId, key, false);
        statusStore.record(userId, before);
      });
    } else archive.act(userId, body);
    return { ...progress(userId), trash: archive.list(userId) };
  }
  return { read: progress, undo, update, setMistake, importMistakes, trash, listTrash: userId => archive.list(userId) };
}
