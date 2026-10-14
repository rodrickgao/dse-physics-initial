import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {officialAnswerHtml} from '../src/lib/study-content.js';

test('2025 Chinese structured answers show complete translated screenshots and preserve original marking evidence',()=>{
 const english=JSON.parse(fs.readFileSync('text-papers/2025-eng.json'));
 const chinese=JSON.parse(fs.readFileSync('text-papers/2025-chn.json'));
 const keys=[...Array.from({length:12},(_,i)=>`2025|paper-1b|${i+1}`),...Array.from({length:4},(_,i)=>`2025|paper-2|${i+1}.S`)];
 for(const key of keys){
  const source=english[key].officialOriginal;
  assert.match(source,/<img /,key);
  assert.equal(chinese[key].officialOriginal,source,key);
  const hash=createHash('sha256').update('compact-v2:'+chinese[key].official).digest('hex').slice(0,24);
  const screenshot=`text-papers/official-screenshots/${hash}.png`;
  assert.ok(fs.existsSync(screenshot),key);
  assert.ok(officialAnswerHtml(chinese[key]).includes(screenshot),key);
  assert.notEqual(officialAnswerHtml(chinese[key]),source,key);
  assert.equal(chinese[key].officialScreenshotType,'typeset',key);
  assert.match(chinese[key].sourceNote,/並非考評局官方中文原卷/,key);
  for(const [,file]of source.matchAll(/src="([^"]+)"/g))assert.ok(fs.existsSync(file),file);
 }
 const q8=fs.readFileSync('text-papers/media/3597875c66cc55f10bd70843.png');
 assert.equal(createHash('sha256').update(q8).digest('hex'),'3597875c66cc55f10bd708433cfb93ab005a752fbae54194d9ed17fc63a06837');
 assert.ok(q8.readUInt32BE(20)>800,'Q8 must include both graphs and the subsequent B/e.m.f. marking rows');
 assert.match(chinese['2025|paper-1b|8'].official,/0\.300 T/);
 assert.match(chinese['2025|paper-1b|8'].official,/2\.70 V/);
 assert.match(chinese['2025|paper-1b|5'].official,/啟動電腦記錄/);
 assert.match(chinese['2025|paper-1b|5'].official,/牛頓第三定律/);
});
