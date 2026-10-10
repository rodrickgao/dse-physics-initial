import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { questionStatsWorkbook } from '../server/question-stats-export.mjs';

test('question statistics export keeps any nonzero metric as numeric Excel cells', async () => {
  const rows = [
    { key: 'all-zero', label: '零记录', marked: 0, active: 0, mastered: 0 },
    { key: 'history-only', label: '历史记录', labelEn: 'History', marked: 2, active: 0, mastered: 0 },
    { key: 'active-only', label: '当前错题', marked: 0, active: 1, mastered: 0 },
    { key: 'mastered-only', label: '已掌握', marked: 0, active: 0, mastered: 3 },
  ];
  for (const language of ['chn', 'eng']) {
    const result = await questionStatsWorkbook(rows, '2026-10-11T00:00:00.000Z', language);
    assert.equal(result.count, 3);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(result.base64, 'base64'));
    const sheet = workbook.worksheets[0];
    assert.equal(sheet.rowCount, 4);
    const actual = sheet.getRows(2, 3).map(row => row.values.slice(1));
    assert.deepEqual(actual.map(row => row[0]), ['history-only', 'active-only', 'mastered-only']);
    assert.equal(actual[0][1], language === 'eng' ? 'History' : '历史记录');
    assert.deepEqual(actual.map(row => row.slice(2)), [[2, 0, 0], [0, 1, 0], [0, 0, 3]]);
    assert.ok(actual.every(row => row.slice(2).every(value => typeof value === 'number')));
    assert.equal(sheet.views[0].ySplit, 1);
  }
});

test('all-zero statistics export remains a valid header-only workbook', async () => {
  const result = await questionStatsWorkbook([{ key: 'zero', label: '零', marked: 0, active: 0, mastered: 0 }], '2026-10-11T00:00:00.000Z');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(result.base64, 'base64'));
  assert.equal(result.count, 0);
  assert.equal(workbook.worksheets[0].rowCount, 1);
});
