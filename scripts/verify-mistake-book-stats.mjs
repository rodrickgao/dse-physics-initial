import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const out=path.resolve('../output/mistake-book-stats-20261013');
const html=await(await fetch('http://127.0.0.1:5178/')).text();
const built=fs.readFileSync('dist/index.html','utf8');
if(html!==built)throw Error('Local preview is not using current build');
const assets=[...html.matchAll(/(?:src|href)="\.\/(assets\/[^\"]+\.(?:js|css))"/g)].map(m=>m[1]);
for(const file of assets){const actual=Buffer.from(await(await fetch('http://127.0.0.1:5178/'+file)).arrayBuffer());if(!actual.equals(fs.readFileSync('dist/'+file)))throw Error('Preview mismatch '+file);}
const files=['src/lib/mistake-book-distribution.js','src/components/MistakeDistributionPie.jsx','src/components/MistakeStatistics.jsx','src/views/MistakesView.jsx','src/ui-consistency.css'];
const report={date:'2026-10-13',scope:'Local only',overview:'Nine books, each question assigned once by existing main chapter',detail:'Book selector and counts for all 46 chapters, including zeros',unclassified:'Separate count outside book pie',tests:{targeted:10,passed:true},browser:JSON.parse(fs.readFileSync(path.join(out,'browser-report.json'),'utf8')),protection:JSON.parse(fs.readFileSync('../output/content-protection/build-audit.json','utf8')),preview:{url:'http://127.0.0.1:5178/#mistakes',htmlMatches:true,assetsMatch:true},files:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),productionChanged:false,studentRecordsChanged:false};
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
console.log('PASS: local preview and latest assets match; verification saved.');
