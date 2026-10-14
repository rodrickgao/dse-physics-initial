import { MEMBERSHIP_ENABLED } from '../src/lib/access-policy.js';
import ExcelJS from 'exceljs';
import { regionLabel } from '../src/lib/region-catalog.js';
import { questions, pointInfo } from './catalog.mjs';

// Each record type has its own grain; only student summary rows hold totals.
export const headers = ['記錄類型', '學生ID', '電郵', '角色', '暱稱', '年級', '地區', '目標等級', '頭像', '註冊時間', '最近登入時間', '目前錯題總數', '目前知識點總數', '目前章節總數', '題目ID', '年份', '試卷', '題號', '目前仍標記', '目前標記時間', '知識點ID列表', '知識點編號列表', '章節編號列表', '知識點ID', '知識點編號', '章節編號', '關聯錯題數', '操作ID', '操作', '操作時間', '匯出時間'];
const iso = value => value == null ? '' : new Date(value).toISOString();
export function exportRows(users, mistakes, events, generatedAt) {
  const rows = [headers];
  for (const user of users) {
    const saved = mistakes.filter(m => m.user_id === user.id);
    const savedByKey = new Map(saved.map(m => [m.question_key, m]));
    const byPoint = new Map(), byChapter = new Map();
    const add = (map, key) => map.set(key, (map.get(key) || 0) + 1);
    for (const m of saved) {
      const links = [...new Set(questions.get(m.question_key)?.points || [])].map(pointInfo);
      links.forEach(p => add(byPoint, p.sequence));
      new Set(links.map(p => p.number.split('.').slice(0, 2).join('.'))).forEach(chapter => add(byChapter, chapter));
    }
    const base = { '學生ID': user.id, '電郵': user.email, '角色': user.role, '暱稱': user.nickname || '', '年級': user.grade || '', '地區': user.region ? regionLabel(user.region) : '', '目標等級': user.target || '', '頭像': user.avatar || '', '註冊時間': iso(user.created_at), '最近登入時間': iso(user.last_login), '匯出時間': generatedAt };
    const push = record => rows.push(headers.map(h => ({ ...base, ...record })[h] ?? ''));
    const question = key => {
      const q = questions.get(key), [year, paper, number] = key.includes('|') ? key.split('|') : ['', key.startsWith('ex-') ? '课本例题' : '课本习题', key.split('-').at(-1)];
      const links = (q?.points || []).map(pointInfo);
      return { '題目ID': key, '年份': year, '試卷': paper, '題號': number,
        '目前仍標記': savedByKey.has(key) ? '是' : '否', '目前標記時間': iso(savedByKey.get(key)?.marked_at),
        '知識點ID列表': JSON.stringify(links.map(p => p.sequence)), '知識點編號列表': JSON.stringify(links.map(p => p.number)),
        '章節編號列表': JSON.stringify([...new Set(links.map(p => p.number.split('.').slice(0, 2).join('.')))]) };
    };
    push({ '記錄類型': '學生摘要', '目前錯題總數': saved.length, '目前知識點總數': new Set([...byPoint.keys()].map(id=>pointInfo(id).number)).size, '目前章節總數': byChapter.size });
    for (const m of saved) push({ '記錄類型': '目前錯題', ...question(m.question_key) });
    for (const [id, count] of byPoint) {
      const p = pointInfo(id);
      push({ '記錄類型': '知識點統計', '知識點ID': id, '知識點編號': p.number, '章節編號': p.number.split('.').slice(0, 2).join('.'), '關聯錯題數': count });
    }
    for (const [chapter, count] of byChapter) push({ '記錄類型': '章節統計', '章節編號': chapter, '關聯錯題數': count });
    for (const event of events.filter(e => e.user_id === user.id)) push({ '記錄類型': '操作歷史', ...question(event.question_key), '操作ID': event.id, '操作': ({mark:'新增錯題',unmark:'移入回收站',restore:'恢復錯題',delete:'學生徹底刪除'}[event.action] || event.action), '操作時間': iso(event.at) });
  }
  return rows;
}
export async function toWorkbook(rows, extra = null, {membershipEnabled = MEMBERSHIP_ENABLED} = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DSE Physics';
  const summaries = new Map(rows.slice(1).filter(row=>row[0]==='學生摘要').map(row=>[row[headers.indexOf('學生ID')],Object.fromEntries(headers.map((field,index)=>[field,row[index]]))]));
  if (extra) {
    const sheet = workbook.addWorksheet('总览', {views:[{state:'frozen',ySplit:1}]});
    sheet.columns=[{header:'指标',width:28},{header:'数值 / 说明',width:80}];
    sheet.addRows([['导出时间',extra.generatedAt],['导出范围','全部学生，不受后台搜索影响'],['学生人数',extra.students.length],...(membershipEnabled?[['有效会员',extra.students.filter(s=>s.membership?.active).length]]:[]),['当前错题',extra.students.reduce((n,s)=>n+s.activeMistakes,0)],['当前已掌握',extra.students.reduce((n,s)=>n+s.mastered,0)],['时间格式','ISO 8601（UTC），末尾 Z 表示 UTC 时间'],['统计说明','已掌握与错题来自自主标记；不是作答次数或正确率。知识点关联可重叠。']]);
  }
  const student=workbook.addWorksheet('学生学习',{views:[{state:'frozen',ySplit:1}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:1'}});
  student.columns=['学生ID','昵称','邮箱','年级','地区','目标等级','当前错题','当前已掌握','累计专注分钟','最近活动时间','角色','头像','注册时间','最近登录时间','相关知识点数','相关章节数','导出时间',...(membershipEnabled?['会员状态','会员到期时间']:[])].map(header=>({header,width:header.includes('时间')?28:header==='邮箱'?34:18}));
  const learning=new Map((extra?.students||[]).map(s=>[s.id,s]));
  const ids=[...new Set([...summaries.keys(),...learning.keys()])].sort((a,b)=>a-b);
  student.addRows(ids.map(id=>{
    const s=learning.get(id)||{},summary=summaries.get(id)||{};
    return [id,s.nickname??summary['暱稱']??'',s.email??summary['電郵']??'',s.grade??summary['年級']??'',s.region!=null?(s.region?regionLabel(s.region):''):summary['地區']||'',s.target??summary['目標等級']??'',s.activeMistakes??summary['目前錯題總數']??0,s.mastered??0,s.focusMinutes??0,iso(s.lastActivity),s.role??summary['角色']??'student',s.avatar??summary['頭像']??'',s.created_at!=null?iso(s.created_at):summary['註冊時間']||'',s.last_login!=null?iso(s.last_login):summary['最近登入時間']||'',summary['目前知識點總數']??0,summary['目前章節總數']??0,extra?.generatedAt??summary['匯出時間']??'',...(membershipEnabled?[({none:'未开通',active:'有效会员',expired:'已到期',revoked:'已暂停'})[s.membership?.status||'none'],iso(s.membership?.endsAt)]:[])];
  }));
  if (extra) {
    const mastered=workbook.addWorksheet('已掌握明细',{views:[{state:'frozen',ySplit:1}]});
    mastered.columns=['学生ID','邮箱','题目ID','标记时间'].map(header=>({header,width:header==='邮箱'?34:28}));
    const users=new Map(extra.students.map(s=>[s.id,s]));
    mastered.addRows(extra.mastered.filter(r=>users.has(r.user_id)).map(r=>[r.user_id,users.get(r.user_id).email,r.question_key,iso(r.marked_at)]));
  }
  const base = ['學生ID', '電郵'];
  const question = ['題目ID', '年份', '試卷', '題號', '目前仍標記', '目前標記時間', '知識點ID列表', '知識點編號列表', '章節編號列表'];
  const sheets = [
    ['目前錯題', [...base, ...question]],
    ['知識點統計', [...base, '知識點ID', '知識點編號', '章節編號', '關聯錯題數']],
    ['章節統計', [...base, '章節編號', '關聯錯題數']],
    ['操作歷史', [...base, '操作ID', '操作', '操作時間', ...question]],
  ];
  for (const [name, fields] of sheets) {
    const columns = [...fields, '匯出時間'];
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' } });
    sheet.columns = columns.map(header => ({ header, key: header, width: header === '電郵' ? 34 : header.includes('時間') ? 28 : header.includes('列表') ? 38 : header === '題目ID' ? 27 : 18 }));
    for (const row of rows.slice(1)) {
      if (row[0] !== name) continue;
      sheet.addRow(columns.map(field => {
        const value = row[headers.indexOf(field)];
        return field.endsWith('列表') ? JSON.parse(value || '[]').join('、') : value;
      }));
    }
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: columns.length } };
    sheet.getRow(1).height = 28;
    sheet.getRow(1).eachCell(cell => {
      cell.font = { name: 'Microsoft JhengHei', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF275FC7' } };
      cell.alignment = { vertical: 'middle' };
    });
    sheet.eachRow((row, index) => { if (index === 1) return; row.eachCell(cell => { cell.font = { name: 'Microsoft JhengHei', size: 11 }; cell.alignment = { vertical: 'top', wrapText: true }; if (typeof cell.value === 'string') cell.numFmt = '@'; }); });
  }
  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).height=30;
    sheet.getRow(1).eachCell(c=>{c.font={name:'Microsoft JhengHei',bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173F87'}};});
    if(sheet.name!=='总览')sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:sheet.columnCount}};
    sheet.eachRow((row,i)=>{if(i===1)return;row.eachCell(c=>{c.font={name:'Microsoft JhengHei',size:11};c.alignment={vertical:'top',wrapText:true};if(typeof c.value==='string')c.numFmt='@';if(i%2===0)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2F6FC'}};});});
  }
  return workbook.xlsx.writeBuffer();
}
