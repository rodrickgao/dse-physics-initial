import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {officialAnswerHtml} from '../src/lib/study-content.js';
import {numberKnowledgePoints} from '../src/lib/knowledge-numbering.js';
import {translate} from '../src/lib/ui-translations.js';
test('all early Paper 2 MC answers display only the verified letter and retain source scans',()=>{
 let count=0;for(const year of [2012,2013,2014])for(const lang of ['chn','eng'])for(const[key,r]of Object.entries(JSON.parse(fs.readFileSync(`text-papers/${year}-${lang}.json`))))if(/\|paper-2\|[1-4]\.[1-8]$/.test(key)){
  assert.match(officialAnswerHtml(r),/^<p>[ABCD]<\/p>$/);assert.match(r.officialScreenshot,/<img/);count++;
 }assert.equal(count,192);
});
test('E1.1.1 uses the concise Chinese title and keeps its stable identity',()=>{
 const c={window:{}};vm.runInNewContext(fs.readFileSync('textbook-data.js','utf8'),c);const p=numberKnowledgePoints(c.window.DSE_TEXTBOOK_DATA.languages.chn).find(p=>p.sequence===384);assert.equal(p.number,'E1.1.1');assert.equal(p.card_title,'天体系统的层级与尺度');assert.doesNotMatch(p.card_summary,/已核对|已核對|本地題文/);
});
test('English UI translates status and dynamic labels without changing Chinese mode',()=>{
 for(const text of ['道已选','问老师','标为已掌握','标为错题','会员至 22/9/2026','2014 年真题','选择 Q1.1']){assert.doesNotMatch(translate(text,'eng'),/[\u3400-\u9fff]/);assert.equal(translate(text,'chn'),text);}
});
