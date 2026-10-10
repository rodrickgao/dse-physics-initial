import ExcelJS from 'exceljs';

export async function questionStatsWorkbook(rows, generatedAt, language = 'chn') {
  const en = language === 'eng';
  const data = rows.filter(row => ['marked', 'active', 'mastered'].some(key => row[key] > 0))
    .sort((a, b) => b.marked - a.marked || a.key.localeCompare(b.key));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ddphysics';
  workbook.created = new Date(generatedAt);
  const sheet = workbook.addWorksheet(en ? 'Question statistics' : '逐题统计', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' },
  });
  const headers = en ? ['Question ID', 'Question', 'Students ever marked', 'Current mistake students', 'Mastered students']
    : ['唯一编号', '题目', '历史标记总人数', '当前错题人数', '已掌握总人数'];
  sheet.columns = headers.map((header, index) => ({ header, width: [28, 65, 25, 25, 23][index] }));
  sheet.addRows(data.map(row => [row.key, en ? row.labelEn || row.label : row.label, row.marked, row.active, row.mastered]));
  sheet.autoFilter = { from: 'A1', to: `E${Math.max(1, sheet.rowCount)}` };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173C69' } };
  sheet.getRow(1).height = 30;
  sheet.eachRow((row, index) => {
    row.alignment = { vertical: 'middle', wrapText: true };
    if (index > 1) for (let column = 3; column <= 5; column++) row.getCell(column).numFmt = '0';
  });
  const bytes = await workbook.xlsx.writeBuffer();
  return { filename: en ? 'Question-statistics.xlsx' : '逐题统计.xlsx', base64: Buffer.from(bytes).toString('base64'), generatedAt, count: data.length };
}
