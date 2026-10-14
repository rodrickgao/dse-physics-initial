import ExcelJS from 'exceljs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { exportRows, toWorkbook } from '../server/student-export.mjs';
import { questions, pointInfo } from '../server/catalog.mjs';

test('student knowledge totals count displayed cards while preserving stable source links',async()=>{
 const keys=['2012|paper-1a|14','2012|paper-1a|22'],users=[{id:1,email:'cards@local.test',role:'student',created_at:0,last_login:0}];
 const rows=exportRows(users,keys.map(question_key=>({user_id:1,question_key,marked_at:0})),[],'2026-10-12T00:00:00Z');
 const expected=new Set(keys.flatMap(key=>questions.get(key).points.map(id=>pointInfo(id).number))).size;
 assert.equal(expected,5);const records=rows.slice(1).map(row=>Object.fromEntries(rows[0].map((h,i)=>[h,row[i]])));
 assert.equal(records.find(r=>r['記錄類型']==='學生摘要')['目前知識點總數'],expected);
 for(const key of keys)assert.deepEqual(JSON.parse(records.find(r=>r['記錄類型']==='目前錯題'&&r['題目ID']===key)['知識點ID列表']),questions.get(key).points);
 const book=new ExcelJS.Workbook();await book.xlsx.load(await toWorkbook(rows));const sheet=book.getWorksheet('学生学习');assert.equal(sheet.getRow(2).getCell(sheet.getRow(1).values.indexOf('相关知识点数')).value,expected);
});

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
  assert.deepEqual(book.worksheets.map(s => s.name), ['学生学习','目前錯題','知識點統計','章節統計','操作歷史']);
  assert.equal(book.getWorksheet('学生学习').getCell('C2').value, user.email);
  assert.equal(book.getWorksheet('学生学习').getCell('C2').type, ExcelJS.ValueType.String);
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


test('enriched export contains learning overview and account-scoped mastery without treating text as formulas',async()=>{
 const rows=exportRows([],[],[],'2026-10-09T00:00:00Z');
 const extra={generatedAt:'2026-10-09T00:00:00Z',students:[{id:4,email:'=test@example.com',nickname:'=1+1',membership:{status:'active',active:true,endsAt:0},activeMistakes:2,mastered:1,focusMinutes:12,lastActivity:0}],mastered:[{user_id:4,question_key:'tb-101-1',marked_at:0},{user_id:99,question_key:'private',marked_at:0}]};
 const book=new ExcelJS.Workbook();await book.xlsx.load(await toWorkbook(rows,extra));
 assert.equal(book.worksheets[0].name,'总览');assert.equal(book.worksheets.length,7);
 const students=book.getWorksheet('学生学习');assert.equal(students.getCell('B2').value,'=1+1');assert.equal(students.getCell('B2').type,ExcelJS.ValueType.String);assert.equal(students.getCell('G2').value,2);assert.equal(students.getCell('H2').value,1);
 assert.equal(book.getWorksheet('已掌握明细').rowCount,2);assert.equal(book.getWorksheet('已掌握明细').getCell('C2').value,'tb-101-1');
 const empty=new ExcelJS.Workbook();await empty.xlsx.load(await toWorkbook(rows,{...extra,students:[],mastered:[]}));assert.equal(empty.getWorksheet('学生学习').rowCount,1);
});

test('merged student sheet joins by ID, keeps all summary fields and contains one row per student',async()=>{
 const users=[{id:1,email:'one@example.com',nickname:'First',role:'student',grade:'中五',region:'hong-kong',target:'5',avatar:'curie-read',created_at:0,last_login:1000},{id:2,email:'empty@example.com',nickname:'Second',role:'student',created_at:2000,last_login:3000}];
 const rows=exportRows(users,[{user_id:1,question_key:'tb-101-1',marked_at:4000}],[],'2026-10-12T00:00:00Z');
 const extra={generatedAt:'2026-10-12T00:00:00Z',students:[{id:2,email:users[1].email,nickname:'Second',activeMistakes:0,mastered:3,focusMinutes:5,lastActivity:6000},{id:1,email:users[0].email,nickname:'First',activeMistakes:1,mastered:2,focusMinutes:20,lastActivity:5000}],mastered:[]};
 const book=new ExcelJS.Workbook();await book.xlsx.load(await toWorkbook(rows,extra));
 assert.equal(book.getWorksheet('學生摘要'),undefined);assert.equal(book.getWorksheet('学生摘要'),undefined);
 const sheet=book.getWorksheet('学生学习');assert.equal(sheet.rowCount,3);
 const labels=sheet.getRow(1).values.slice(1);assert.equal(new Set(labels).size,labels.length);
 const records=[2,3].map(n=>Object.fromEntries(labels.map((label,i)=>[label,sheet.getRow(n).getCell(i+1).value])));
 assert.deepEqual(records.map(r=>r['学生ID']),[1,2]);
 assert.equal(records[0]['当前已掌握'],2);assert.equal(records[1]['当前已掌握'],3);
 assert.equal(records[0]['头像'],'curie-read');assert.equal(records[0]['角色'],'student');assert.equal(records[0]['地区'],'香港');
 assert.equal(records[0]['注册时间'],'1970-01-01T00:00:00.000Z');assert.equal(records[0]['最近登录时间'],'1970-01-01T00:00:01.000Z');
 assert.equal(records[0]['累计专注分钟'],20);assert.equal(records[0]['当前错题'],1);assert.equal(records[1]['当前错题'],0);
 assert.equal(records[0]['相关知识点数'],questions.get('tb-101-1').points.length);assert.equal(records[0]['导出时间'],extra.generatedAt);
 assert.equal(sheet.views[0].state,'frozen');assert.ok(sheet.autoFilter);
});
