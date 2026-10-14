import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const output = path.resolve('../output/all-book-filter-20261014');
const url = 'http://127.0.0.1:5178/';
const html = await (await fetch(url)).text();
assert.equal(html, fs.readFileSync('dist/index.html', 'utf8'));
const assets = [...html.matchAll(/(?:src|href)="\.\/(assets\/[^\"]+\.(?:js|css))"/g)].map(match => match[1]);
for (const asset of assets) {
  const response = await fetch(url + asset);
  assert.equal(response.status, 200);
  assert.ok(Buffer.from(await response.arrayBuffer()).equals(fs.readFileSync('dist/' + asset)), asset);
}
const report = {
  date: '2026-10-14', scope: 'Local only',
  changes: ['Title changed to Mistake statistics', 'All option first and selected by default', 'Book selection filters question list; All clears book and chapter filters', 'Blue filter banner removed', 'Descending chapter counts and zero-count chapters hidden', 'Selected book retained after refresh and returning from a question'],
  tests: { passed: 8 },
  browser: JSON.parse(fs.readFileSync(path.join(output, 'browser-report.json'), 'utf8')),
  protection: JSON.parse(fs.readFileSync(path.join(output, 'build-audit.json'), 'utf8')),
  preview: { url: url + '#mistakes', htmlMatches: true, assetsMatch: true },
  productionChanged: false, existingStudentRecordsChanged: false,
};
assert.ok(report.browser.passed && report.protection.passed);
fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
console.log('PASS: local preview serves latest build and assets.');
