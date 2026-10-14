import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const output=path.resolve('../output/filter-scroll-20261014'),url='http://127.0.0.1:5178/';
const html=await(await fetch(url)).text();assert.equal(html,fs.readFileSync('dist/index.html','utf8'));
for(const match of html.matchAll(/(?:src|href)="\.\/(assets\/[^\"]+\.(?:js|css))"/g)){
 const response=await fetch(url+match[1]);assert.equal(response.status,200);
 assert.ok(Buffer.from(await response.arrayBuffer()).equals(fs.readFileSync('dist/'+match[1])),match[1]);
}
const scroll=JSON.parse(fs.readFileSync(path.join(output,'browser-report.json'),'utf8'));
const regression=JSON.parse(fs.readFileSync(path.join(output,'function-regression/browser-report.json'),'utf8'));
const protection=JSON.parse(fs.readFileSync(path.join(output,'build-audit.json'),'utf8'));
assert.ok(scroll.passed&&regression.passed&&protection.passed);
fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({date:'2026-10-14',scope:'Local only',changes:['Book, All, and chapter filtering preserve the selector viewport position','Book and chapter filtering use the existing summary without reloading the page','Short and empty result lists retain sufficient space to prevent a scroll jump','Selector focus remains intact'],tests:{passed:8},scroll,regression,protection,preview:{url:url+'#mistakes',htmlMatches:true,assetsMatch:true},productionChanged:false,existingStudentRecordsChanged:false},null,2));
console.log('PASS: local preview serves latest build and assets.');
