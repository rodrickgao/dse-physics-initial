import { databaseQueries } from './database.mjs';
import { questions, pointInfo } from './catalog.mjs';
import { publicProfile as publicUser } from './profile.mjs';
import { exportRows, toWorkbook } from './student-export.mjs';
import { studentLearning } from './student-learning.mjs';

// Read-only reporting and spreadsheet preparation, separate from HTTP routing.
export function createAdminReports({ db, clock, fail, management, learning }) {
  const { get, all, transaction } = databaseQueries(db);
  function aggregate(rows) {
    const byPoint = new Map(); const byQuestion = new Map(); const byChapter = new Map();
    const add = (map, key, info, user) => { if (!map.has(key)) map.set(key, { ...info, count: 0, students: new Set() }); const v = map.get(key); v.count++; v.students.add(user); };
    for (const row of rows) {
      const q = questions.get(row.question_key); if (!q) continue;
      add(byQuestion, q.key, q, row.user_id);
      const chapters = new Set();
      for (const id of q.points) { const info = pointInfo(id); add(byPoint, id, info, row.user_id); chapters.add(info.chapter); }
      for (const chapter of chapters) add(byChapter, chapter, { chapter }, row.user_id);
    }
    const list = map => [...map.values()].map(v => ({ ...v, students: v.students.size })).sort((a, b) => b.count - a.count);
    return { points: list(byPoint), questions: list(byQuestion), chapters: list(byChapter) };
  }

  async function exportWorkbook() {
    const generatedAt = new Date(clock()).toISOString();
    const exportData = transaction(() => ({ rows: exportRows(
      all("SELECT id,email,role,created_at,last_login,nickname,grade,region,target,target_major,avatar FROM users WHERE role='student' ORDER BY id"),
      all('SELECT user_id,question_key,marked_at FROM mistakes ORDER BY user_id,marked_at,question_key'),
      all('SELECT id,user_id,question_key,action,at FROM events ORDER BY user_id,at,id'), generatedAt), extra:{generatedAt,students:management.overview().students,mastered:all('SELECT user_id,question_key,marked_at FROM mastered ORDER BY user_id,marked_at,question_key')} }));
    const bytes = await toWorkbook(exportData.rows,exportData.extra);
    return { filename: '學生完整學習資料.xlsx', base64: Buffer.from(bytes).toString('base64'), generatedAt };
  }
  function stats() {
    const rows = all("SELECT m.* FROM mistakes m JOIN users u ON m.user_id=u.id WHERE u.role='student'");
    const byStudent = new Map();
    for (const row of rows) {
      if (!byStudent.has(row.user_id)) byStudent.set(row.user_id, []);
      byStudent.get(row.user_id).push(row);
    }
    const students = all("SELECT id,email,role,created_at,last_login,nickname,grade,region,target,target_major,avatar,avatar_version FROM users WHERE role='student' ORDER BY last_login DESC").map(u => {
      const saved = byStudent.get(u.id) || []; const stats = aggregate(saved);
      return { ...u, ...publicUser(u), mistakeCount: saved.length, pointCount: stats.points.length };
    });
    const totals = aggregate(rows);
    return { students, ...totals, summary: { students: students.length, marks: rows.length, questions: new Set(rows.map(r => r.question_key)).size, points: totals.points.length }, activity: all("SELECT strftime('%Y-%m-%d',e.at/1000,'unixepoch','+8 hours') day,e.action,count(*) count FROM events e JOIN users u ON u.id=e.user_id WHERE u.role='student' AND e.at>? GROUP BY day,e.action ORDER BY day DESC", clock() - 30 * 86400000), generatedAt: new Date(clock()).toISOString() };
  }
  function student(url) {
    const student = get("SELECT id,email,role,created_at,last_login,nickname,grade,region,target,target_major,avatar,avatar_version FROM users WHERE id=? AND role='student'", Number(url.searchParams.get('id')) || 0);
    if (!student) fail(404, '找不到學生。');
    const rows = all('SELECT * FROM mistake_archive WHERE user_id=? ORDER BY marked_at DESC', student.id);
    const active = all('SELECT question_key,marked_at FROM mistakes WHERE user_id=?', student.id);
    const masteredRows = all('SELECT question_key,marked_at FROM mastered WHERE user_id=? ORDER BY marked_at DESC', student.id);
    const analytics=learning.dashboard(student.id,{language:url.searchParams.get("language")==="eng"?"eng":"chn"});
    return { student, analytics, learning: studentLearning(active, masteredRows, rows, analytics.recommendations), ...aggregate(rows), mistakes: rows.map(r => ({ ...questions.get(r.question_key), status: r.status, trashedAt: r.trashed_at, deletedAt: r.deleted_at, markedAt: new Date(r.marked_at).toISOString(), knowledge: (questions.get(r.question_key)?.points || []).map(pointInfo) })) };
  }
  return { exportWorkbook, stats, student };
}
