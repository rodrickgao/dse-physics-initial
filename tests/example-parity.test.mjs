import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {localizeChineseExampleFigures,chineseExampleFigures} from '../scripts/chinese-example-figures.mjs';
import {omitTextbookReferences} from '../scripts/omit-textbook-references.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const base='assets/textbook-examples';
const fields=['question','answer','tips','think','thinkAnswer'];
const images=s=>[...s.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(m=>({src:m[1],width:/style="([^"]+)"/.exec(m[0])?.[1]}));
const overrides=read('scripts/example-parity-overrides.json');

test('Chinese examples omit standalone textbook exercise references and keep explanations',()=>{
 const answer=read(`${base}/chn/407.json`)['ex-407-5'].answer;
 assert.ok(!answer.includes('複習7 Q4 (p.310)'));
 assert.ok(!answer.includes('溫習 7 第 4 題（第 310 頁）'));
 assert.match(answer,/磁棒會受到較大的磁力抗衡/);
 assert.equal(omitTextbookReferences('<p>練習判斷感生電流的方向。</p>'),'<p>練習判斷感生電流的方向。</p>');
 for(const file of fs.readdirSync(`${base}/chn`).filter(f=>f.endsWith('.json')))
  for(const q of Object.values(read(`${base}/chn/${file}`)))
   for(const field of fields)assert.equal(omitTextbookReferences(q[field]),q[field],`${q.id}/${field}`);
});
test('every Chinese example keeps complete source artwork with Chinese diagram labels',()=>{
 let total=0,figures=0,think=0;
 for(const file of fs.readdirSync(`${base}/eng`).filter(f=>f.endsWith('.json'))){
  const en=read(`${base}/eng/${file}`),zh=read(`${base}/chn/${file}`);
  assert.deepEqual(Object.keys(zh),Object.keys(en));
  for(const [id,q] of Object.entries(en)){
   total++;if(q.think)think++;
   for(const field of fields){
    assert.deepEqual(images(zh[id][field]),images(localizeChineseExampleFigures(q[field])),`${id}/${field}: complete source images and dimensions`);
    figures+=images(q[field]).length;
    assert.equal(Boolean(zh[id][field]),Boolean(q[field]),`${id}/${field}: section presence`);
    assert.ok(!/data-math=|katex-error|\(cid:/.test(zh[id][field]),id);
    if(overrides[id]?.[field]){
     const v=overrides[id][field];
     assert.equal(v.sourceSha256,createHash('sha256').update(q[field]).digest('hex'),`${id}/${field}: stale translation`);
     assert.equal(zh[id][field],omitTextbookReferences(localizeChineseExampleFigures(v.html)),`${id}/${field}: reviewed content must survive publication`);
    }
   }
   assert.ok(overrides[id].tips!==undefined,`${id}: tips translated from English`);
   if(q.think)assert.ok(overrides[id].think&&overrides[id].thinkAnswer,`${id}: complete translated Think about pair`);
  }
 }
 assert.equal(total,373);assert.equal(think,51);assert.equal(figures,456);
});
test('reported composite-image example and multi-column answers retain all parts',()=>{
 const q=read(`${base}/chn/401.json`)['ex-401-3'];
 assert.match(q.question,/圖 a/);assert.match(q.question,/圖 b/);assert.match(q.question,/圖 c/);
 assert.match(q.question,/ad1409487cce44cb75c9a304\.png/);
 assert.match(q.answer,/感應電荷/);assert.match(q.answer,/排斥/);
 assert.match(q.thinkAnswer,/極化/);
 const energy=read(`${base}/chn/206.json`)['ex-206-5'].answer;
 assert.ok(energy.indexOf('方法一')<energy.indexOf('方法二'));
 assert.equal((energy.match(/1\.98/g)||[]).length,2);
 const snow=read(`${base}/chn/202.json`)['ex-202-7'].answer;
 assert.ok(!/技技巧|技巧分析|①/.test(snow));
 const nuclear=read(`${base}/chn/502.json`)['ex-502-5'].answer;
 assert.match(nuclear,/5 個半衰期/);assert.match(nuclear,/<msup>/);
});

test('Chinese induction diagrams translate explanatory labels and retain verified original assets',()=>{
 const key='assets/textbook-examples/media/d6624488b5495463f2a2e8ea.png';
 const diagram=chineseExampleFigures[key];
 assert.ok(diagram);
 assert.deepEqual(diagram.translations.map(t=>t.chinese).sort(),['移近線圈','在線圈正中間','移離線圈','磁棒'].sort());
 const q=read(`${base}/chn/407.json`)['ex-407-1'];
 assert.ok(q.question.includes(diagram.src));
 for(const [source,entry]of Object.entries(chineseExampleFigures)){
  assert.equal(createHash('sha256').update(fs.readFileSync(source)).digest('hex'),entry.originalSha256);
  assert.equal(createHash('sha256').update(fs.readFileSync(entry.src)).digest('hex'),entry.sha256);
  assert.ok((entry.pathsPreserved || (entry.vectorTable&&entry.sourceValuesPreserved))&&entry.embeddedImagesPreserved);
  for(const t of entry.translations)assert.match(t.chinese,/[\u3400-\u9fff。]/,source);
 }
});
