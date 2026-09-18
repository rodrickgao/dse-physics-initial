import ExcelJS from 'exceljs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { exportRows, toWorkbook } from '../server/student-export.mjs';
import { questions } from '../server/catalog.mjs';

test('complete export includes empty students, unique mistakes, knowledge and unlimited history', () => {
  const keys = [...questions.keys()].slice(0, 2);
  const users = [{ id: 1, email: 'one@example.com', role: 'student', created_at: 0, last_login: 1000 }, { id: 2, email: 'empty@example.com', role: 'student', created_at: 0, last_login: 1000 }];
  const rows = exportRows(users, [{ user_id: 1, question_key: keys[1], marked_at: 2000 }], [
    { id: 1, user_id: 1, question_key: keys[0], action: 'mark', at: 0 },
    { id: 2, user_id: 1, question_key: keys[0], action: 'unmark', at: 1000 },
    { id: 3, user_id: 1, question_key: keys[1], action: 'mark', at: 2000 }], '2026-09-16T00:00:00.000Z');
  const records = rows.slice(1).map(row => Object.fromEntries(rows[0].map((h, i) => [h, row[i]])));
  assert.ok(rows.every(r => r.length === rows[0].length));
  const summary = records.filter(r => r['記錄類型'] === '學生摘要');
  assert.equal(summary.length, 2); assert.equal(summary[0]['目前錯題總數'], 1); assert.equal(summary[1]['目前錯題總數'], 0);
  const saved = records.filter(r => r['記錄類型'] === '目前錯題');
  assert.equal(saved.length, 1); assert.equal(saved[0]['題目ID'], keys[1]);
  assert.deepEqual(JSON.parse(saved[0]['知識點ID列表']), questions.get(keys[1]).points);
  const history = records.filter(r => r['記錄類型'] === '操作歷史');
  assert.equal(history.length, 3); assert.equal(history[0]['目前仍標記'], '否');
  assert.equal(history[0]['操作時間'], '1970-01-01T00:00:00.000Z');
  assert.equal(history[2]['目前仍標記'], '是');
  assert.equal(records.filter(r => r['記錄類型'] === '知識點統計').length, questions.get(keys[1]).points.length);
  assert.deepEqual(exportRows([], [], [], 'now').length, 1);
});
test('workbook separates record types, preserves identifiers and excludes content', async () => {
  const key = [...questions.keys()][0];
  const user = { id: 1, email: '=formula@example.com', role: 'student', created_at: 0, last_login: 0 };
  const rows = exportRows([user], [{ user_id: 1, question_key: key, marked_at: 0 }], [{ id: 1, user_id: 1, question_key: key, action: 'mark', at: 0 }], '2026-09-16T00:00:00.000Z');
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await toWorkbook(rows));
  assert.deepEqual(book.worksheets.map(s => s.name), ['學生摘要','目前錯題','知識點統計','章節統計','操作歷史']);
  assert.equal(book.getWorksheet('學生摘要').getCell('B2').value, user.email);
  assert.equal(book.getWorksheet('學生摘要').getCell('B2').type, ExcelJS.ValueType.String);
  assert.equal(book.getWorksheet('目前錯題').rowCount, 2);
  assert.equal(book.getWorksheet('操作歷史').rowCount, 2);
  assert.equal(book.getWorksheet('目前錯題').getCell('C2').value, key);
  for (const sheet of book.worksheets) {
    assert.equal(sheet.views[0].state,'frozen');
    sheet.getRow(1).eachCell(c => assert.ok(!/內容|名稱|原題/.test(c.value)));
  }
  const pointSheet=book.getWorksheet('知識點統計');
  assert.match(pointSheet.getCell('D2').value,/^E?\d+\.\d+\.\d+$/);
  assert.equal(typeof pointSheet.getCell('D2').value, 'string');
  const empty=new ExcelJS.Workbook();await empty.xlsx.load(await toWorkbook(exportRows([],[],[],'now')));
  assert.equal(empty.worksheets.length,5);assert.ok(empty.worksheets.every(s=>s.rowCount===1));
});
