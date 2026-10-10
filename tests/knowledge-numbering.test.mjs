import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {numberKnowledgePoints} from '../src/lib/knowledge-numbering.js';
import {sharedFigureCards} from '../src/lib/shared-figure-cards.js';
import {pointInfo} from '../server/catalog.mjs';
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('textbook-data.js','utf8'),ctx);
const data=ctx.window.DSE_TEXTBOOK_DATA.languages;
test('one number per existing card, with no gaps and identical bilingual numbering',()=>{
 const structures=[];
 for(const lang of ['chn','eng']){
  const points=numberKnowledgePoints(data[lang]),cards=sharedFigureCards(points);
  assert.equal(cards.length,281);assert.equal(new Set(cards.map(c=>c.number)).size,281);
  const counters=new Map();
  for(const c of cards){
   const key=c.book_key+'|'+c.code,n=(counters.get(key)||0)+1;counters.set(key,n);
   assert.equal(Number(c.number.split('.').at(-1)),n);
   for(const member of c.members||[c]){assert.equal(member.number,c.number);assert.equal(member.card_sequence,c.sequence);}
  }
  structures.push(cards.map(c=>[c.number,(c.members||[c]).map(p=>p.sequence)]));
 }
 assert.deepEqual(structures[0],structures[1]);
});
test('renumbering preserves all source content and identities without mutating the input',()=>{
 for(const lang of ['chn','eng']){
  const before=JSON.stringify(data[lang]);const numbered=numberKnowledgePoints(data[lang]);
  assert.equal(JSON.stringify(data[lang]),before);assert.equal(numbered.length,413);
  const raw=new Map(data[lang].map(p=>[p.sequence,p]));
  for(const p of numbered){const {number,card_sequence,...original}=p;const {number:oldNumber,card_sequence:oldCard,...source}=raw.get(p.sequence);assert.equal(JSON.stringify(original),JSON.stringify(source));}
 }
});
test('merged heat capacity cards have one number and saved source links resolve to that number',()=>{
 const cards=sharedFigureCards(numberKnowledgePoints(data.chn)).filter(c=>c.code==='103');
 assert.equal(cards[1].number,'1.3.2');assert.equal(cards[1].members.length,2);
 assert.equal(cards[2].number,'1.3.3');assert.equal(cards[2].members.length,2);
 for(const c of cards)for(const p of c.members||[c]){assert.equal(pointInfo(p.sequence).sequence,p.sequence);assert.equal(pointInfo(p.sequence).number,c.number);assert.equal(pointInfo(p.sequence).title,c.card_title||c.title);}
});
