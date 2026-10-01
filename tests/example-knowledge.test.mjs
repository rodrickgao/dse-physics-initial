import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {orderKnowledge} from '../src/lib/knowledge-order.js';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
const links=read('../src/lib/textbook-example-knowledge.json');
const audit=read('../scripts/textbook-example-knowledge-audit.json');
const index=read('../assets/textbook-examples/index-eng.json');
const source=fs.readFileSync(new URL('../textbook-data.js',import.meta.url),'utf8');
const knowledge=JSON.parse(source.slice(source.indexOf('{')).trim().replace(/;$/,''));
test('every example has an explicit source-tracked selection of valid knowledge identities',()=>{
 assert.deepEqual(Object.keys(links).sort(),index.questions.map(q=>q.id).sort());
 const points=new Map(knowledge.languages.eng.map(p=>[p.sequence,p]));
 for(const chapter of new Set(index.questions.map(q=>q.chapter))){
  const records=read(`../assets/textbook-examples/eng/${chapter}.json`);
  for(const r of Object.values(records)){
   assert.equal(new Set(links[r.id]).size,links[r.id].length);
   for(const sequence of links[r.id]){assert.ok(points.has(sequence),`${r.id}: ${sequence}`);if(chapter.startsWith('E'))assert.equal(points.get(sequence).code.slice(0,2),chapter.slice(0,2),'elective books stay separate');}
   const hash=crypto.createHash('sha256').update([r.question,r.answer,r.think||'',r.thinkAnswer||''].join('\n')).digest('hex');
   assert.equal(audit[r.id].contentSha256,hash,`${r.id}: changed content needs association review`);
  }
 }
});
test('different examples in the same chapter link to their actual concepts',()=>{
 assert.deepEqual(links['ex-202-2'],[48]);
 assert.deepEqual(links['ex-202-3'],[50]);
 assert.deepEqual(links['ex-202-4'],[51]);
 assert.deepEqual(links['ex-202-11'],[54,55]);
 assert.deepEqual(links['ex-102-1'],[6]);
 assert.deepEqual(links['ex-E303-7'],[],'no unrelated fallback for a missing yellow-box point');
});
test('display numbering sorts numerically without mutating source identities or link metadata',()=>{
 const ids=[10,9,1,12];const names={10:'2.2.10',9:'2.2.9',1:'2.1.1',12:'E1.1.1'};
 assert.deepEqual(orderKnowledge(ids,s=>names[s]),[1,9,10,12]);assert.deepEqual(ids,[10,9,1,12]);
 const objects=ids.map(sequence=>({sequence,type:'primary'}));assert.deepEqual(orderKnowledge(objects,s=>names[s]).map(x=>x.sequence),[1,9,10,12]);
});
