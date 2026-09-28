const COLORS = ['#2563eb', '#14b8a6', '#f59e0b', '#94a3b8'];

export function ChapterPie({ chapters, language, onDetails }) {
  const en = language === 'eng';
  const ranked = [...chapters].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  const rows = ranked.slice(0, 3);
  const other = ranked.slice(3).reduce((sum, [, count]) => sum + count, 0);
  if (other) rows.push([en ? 'Other' : '其他', other]);
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  if (!total) return <p className="chapter-pie-empty">{en ? 'No chapter data yet.' : '暂无章节数据'}</p>;
  let offset = 0;
  const stops = rows.map(([, count], index) => {
    const start = offset;
    offset += count / total * 100;
    return `${COLORS[index]} ${start}% ${offset}%`;
  });
  return <div className="chapter-pie-chart">
    <button type="button" className="chapter-pie" onClick={onDetails} aria-label={en ? 'View detailed chapter statistics' : '查看详细章节统计'} title={en ? 'View detailed statistics' : '查看详细统计'}><span role="img" aria-label={`${en ? 'Chapter distribution' : '错题章节分布'}：${rows.map(([name, count]) => `${name} ${count}`).join('；')}`} style={{ background: `conic-gradient(${stops.join(',')})` }} /></button>
    <ul className="chapter-pie-legend">{rows.map(([name, count], index) => <li key={index}>
      <i aria-hidden="true" style={{ backgroundColor: COLORS[index] }} /><span>{name}</span><strong>{count}</strong>
    </li>)}</ul>
    <button className="chapter-statistics-link" onClick={onDetails}>{en ? 'View detailed statistics' : '查看详细统计'}</button>
  </div>;
}
