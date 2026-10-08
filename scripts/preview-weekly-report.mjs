import {mkdirSync,writeFileSync} from 'node:fs';
import {weeklyReportEmail} from '../server/weekly-report-email.mjs';

const report={name:'同学',period:'2026.09.21 — 09.27 · 学习周报',mastered:42,mistakes:18,knowledge:12,minutes:156,weaknesses:[
  {title:'牛顿第二定律',chapter:'力与运动',count:6},
  {title:'动量守恒',chapter:'力与运动',count:4},
  {title:'电势差与电动势',chapter:'电与磁',count:3},
]};
const email=await weeklyReportEmail({from:'preview@example.invalid',to:'preview@example.invalid',report});
let html=email.html;
for(const image of email.attachments) html=html.replace(`cid:${image.cid}`,`data:${image.contentType};base64,${image.content.toString('base64')}`);
html=html.replace('<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f2f5fa">','<div style="text-align:center;padding:12px 16px 0;font:11px/18px Arial,sans-serif;color:#8493a8;">设计预览 · 以下均为示例数据</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f2f5fa">');
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});
writeFileSync(new URL('../dist/weekly-report-preview.html',import.meta.url),html);
console.log('http://127.0.0.1:5178/weekly-report-preview.html');
