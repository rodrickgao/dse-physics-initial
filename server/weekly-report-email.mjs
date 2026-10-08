import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { qdnaWeeklyEmail } from './qdna-weekly-email.mjs';

const logo = readFileSync(new URL('./email/brand-mark.png', import.meta.url));
const cid = 'weekly-brand@ddphysics.com';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Presentation-only template. No scheduled delivery or student-data query is connected.
export async function weeklyReportEmail({from, to, report}) {
  if (report.kind === 'qdna-weekly') return qdnaWeeklyEmail({from,to,report});
  const metrics = [
    ['本周掌握', report.mastered, '题', '#245dcc'],
    ['新增错题', report.mistakes, '题', '#b56a32'],
    ['知识点覆盖', report.knowledge, '个', '#245dcc'],
    ['累计专注', report.minutes, '分钟', '#238475'],
  ];
  const tile = ([label,value,unit,color]) => `<td width="50%" valign="top" style="padding:6px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="metric" bgcolor="#f7f9fc" style="border:1px solid #edf0f5;border-radius:12px;padding:20px 18px;"><div style="font-size:13px;line-height:20px;color:#66748a;">${label}</div><div style="padding:8px 0 7px;line-height:44px;white-space:nowrap;"><strong class="metric-number" style="font-size:38px;font-weight:700;letter-spacing:-1px;color:${color};">${escape(value)}</strong><span style="font-size:12px;color:#718096;padding-left:7px;">${unit}</span></div></td></tr></table></td>`;
  const colors = ['#245dcc','#26a69a','#e7ae54','#dce3ed'];
  const rows = report.weaknesses.map(item => ({...item}));
  const other = Math.max(0, report.mistakes - rows.reduce((sum,item)=>sum+item.count,0));
  if(other) rows.push({title:'其他知识点',count:other});
  const total = rows.reduce((sum,item)=>sum+item.count,0);
  let offset=0;
  const segments=rows.map((item,i)=>{
    const length=total ? item.count/total*(2*Math.PI*88) : 0;
    const svg=`<circle cx="120" cy="120" r="88" fill="none" stroke="${colors[i]}" stroke-width="30" stroke-dasharray="${length} ${2*Math.PI*88-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 120 120)"/>`;
    offset+=length;return svg;
  }).join('');
  const chart=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 240 240"><rect width="240" height="240" fill="white"/><circle cx="120" cy="120" r="88" fill="none" stroke="#edf0f5" stroke-width="30"/>${segments}<text x="120" y="132" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="#223650">${total}</text></svg>`)).png().toBuffer();
  const legend=rows.map((item,i)=>`<tr><td style="padding:10px 0;border-bottom:1px solid #f0f3f7;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="18" valign="top" style="padding-top:6px;"><div style="width:8px;height:8px;border-radius:3px;background:${colors[i]};"></div></td><td><div style="font-size:13px;line-height:21px;color:#223650;">${escape(item.title)}</div>${item.chapter?`<div style="font-size:10px;line-height:17px;color:#98a3b3;">${escape(item.chapter)}</div>`:''}</td><td width="68" align="right" style="font-size:12px;line-height:21px;color:#223650;white-space:nowrap;">${item.count} 题 <span style="color:#98a3b3;font-size:10px;">· ${total?Math.round(item.count/total*100):0}%</span></td></tr></table></td></tr>`).join('');
  const subject = '你的 DSE Physics 学习周报';
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${subject}</title><style>@media(max-width:480px){.outer{padding:16px 8px!important}.content{padding:26px 20px!important}.title{font-size:27px!important}.metric{padding:16px 12px!important}.metric-number{font-size:32px!important}.report-label{display:none!important}.chart-cell,.legend-cell{display:block!important;width:100%!important}.chart-cell{padding:0 0 12px!important}.chart-image{width:160px!important;height:160px!important}}</style></head>
<body style="margin:0;background:#f2f5fa;font-family:Arial,'Microsoft YaHei',sans-serif;color:#223650;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">本周掌握 ${escape(report.mastered)} 道题，专注 ${escape(report.minutes)} 分钟。查看你的学习足迹。</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f2f5fa"><tr><td class="outer" align="center" style="padding:32px 12px;">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:600px;border:1px solid #e3e9f2;border-radius:18px;"><tr><td class="content" style="padding:32px 36px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="42"><img src="cid:${cid}" width="36" height="36" alt="DSE Physics" style="display:block;border:0;border-radius:9px;"></td><td style="padding-left:8px;"><strong style="font-size:17px;line-height:22px;color:#223650;">DSE Physics</strong><div style="font-size:11px;line-height:17px;color:#8a96a7;">ddphysics.com</div></td><td class="report-label" align="right" style="font-size:10px;letter-spacing:1.5px;color:#8a96a7;">WEEKLY REPORT</td></tr></table>
<div style="height:30px;line-height:30px;">&nbsp;</div>
<div style="font-size:12px;line-height:20px;color:#78879b;">${escape(report.period)}</div>
<h1 class="title" style="margin:8px 0 10px;font-size:30px;line-height:42px;letter-spacing:-1px;color:#172b46;">这一周，进步看得见。</h1>
<p style="margin:0 0 23px;font-size:13px;line-height:23px;color:#78879b;">${escape(report.name)}，这是你的本周物理学习记录。</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;"><tr>${metrics.slice(0,2).map(tile).join('')}</tr><tr>${metrics.slice(2).map(tile).join('')}</tr></table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:26px 6px 0;"><h2 style="margin:0;font-size:17px;line-height:26px;color:#223650;">本周错题分布</h2><div style="height:14px;line-height:14px;">&nbsp;</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="chart-cell" width="190" align="center" valign="middle" style="padding-right:16px;"><img class="chart-image" src="cid:weekly-distribution@ddphysics.com" width="180" height="180" alt="本周 ${total} 道错题的知识点分布，详细数量见旁边列表" style="display:block;width:180px;height:180px;border:0;"/><div style="font-size:11px;line-height:20px;color:#8893a3;">本周新增错题 · ${total} 题</div></td><td class="legend-cell" valign="middle"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${legend}</table></td></tr></table></td></tr></table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding-top:26px;"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#245dcc" style="border-radius:9px;"><a href="https://ddphysics.com" style="display:inline-block;padding:14px 36px;font-size:14px;line-height:20px;font-weight:600;text-decoration:none;color:#ffffff;">回到自习室，继续进步&nbsp; →</a></td></tr></table><p style="margin:12px 0 0;font-size:11px;line-height:18px;"><a href="https://ddphysics.com" style="color:#8493a8;text-decoration:none;">ddphysics.com</a></p></td></tr></table>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
<p style="max-width:540px;margin:18px 0 0;font-size:10px;line-height:19px;color:#98a3b3;">每一次认真思考，都在让物理变得更清晰。<br>DSE Physics · 你的物理自习室</p>
</td></tr></table></body></html>`;
  const text = `${subject}\n${report.period}\n\n${metrics.map(([label,value,unit])=>`${label}：${value} ${unit}`).join('\n')}\n\n优先复习：\n${report.weaknesses.map((w,i)=>`${i+1}. ${w.title}（${w.count} 道错题）`).join('\n')}\n\n回到自习室：https://ddphysics.com`;
  return {from,to,subject,html,text,attachments:[{filename:'weekly-distribution.png',content:chart,contentType:'image/png',cid:'weekly-distribution@ddphysics.com',contentDisposition:'inline'},{filename:'dse-physics.png',content:logo,contentType:'image/png',cid,contentDisposition:'inline'}]};
}
