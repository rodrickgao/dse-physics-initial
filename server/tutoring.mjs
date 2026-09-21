import { randomUUID } from 'node:crypto';
import { questions, points, pointInfo } from './catalog.mjs';

export function createTutoring({ db, clock, fail }) {
  db.exec(`CREATE TABLE IF NOT EXISTS tutoring_questions (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL, reference TEXT NOT NULL, message TEXT NOT NULL,
    created_at INTEGER NOT NULL, reply TEXT NOT NULL DEFAULT '',
    replied_at INTEGER, replied_by INTEGER REFERENCES users(id));
    CREATE INDEX IF NOT EXISTS tutoring_user ON tutoring_questions(user_id, created_at);`);
  const rows = userId => db.prepare(`SELECT q.*, u.nickname, u.email FROM tutoring_questions q
    JOIN users u ON u.id=q.user_id ${userId == null ? '' : 'WHERE q.user_id=?'}
    ORDER BY q.created_at DESC`).all(...(userId == null ? [] : [userId])).map(row => ({
      ...row, context: row.kind === 'question' ? questions.get(row.reference) : row.kind === 'knowledge' ? pointInfo(Number(row.reference)) : null,
    }));
  return {
    list: rows,
    submit(userId, body) {
      const kind = body.kind, reference = String(body.reference || '');
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!['question', 'knowledge', 'general'].includes(kind) || !message || message.length > 5000) fail(400, '请选择提问类型，并输入 1–5000 字的问题。');
      if (kind === 'question' && !questions.has(reference)) fail(400, '题目不存在。');
      if (kind === 'knowledge' && !points.has(Number(reference))) fail(400, '知识点不存在。');
      if (kind === 'general' && reference) fail(400, '通用问题不需要关联题目。');
      db.prepare('INSERT INTO tutoring_questions(id,user_id,kind,reference,message,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(), userId, kind, kind === 'general' ? '' : reference, message, clock());
      return { rows: rows(userId) };
    },
    reply(actor, body) {
      const reply = typeof body.reply === 'string' ? body.reply.trim() : '';
      if (!reply || reply.length > 10000) fail(400, '请输入 1–10000 字的回复。');
      const result = db.prepare("UPDATE tutoring_questions SET reply=?,replied_at=?,replied_by=? WHERE id=? AND reply=''").run(reply, clock(), actor.id, String(body.id || ''));
      if (!result.changes) fail(409, '问题不存在或已经回复，请刷新。');
      return { rows: rows() };
    },
  };
}
