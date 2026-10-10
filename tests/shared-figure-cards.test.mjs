import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {sharedFigureCards,cardFigures,cardSections} from '../src/lib/shared-figure-cards.js';
import { duplicateCardGroups } from '../src/lib/duplicate-card-groups.js';
import {numberKnowledgePoints} from '../src/lib/knowledge-numbering.js';
const c={window:{}};vm.runInNewContext(fs.readFileSync('textbook-data.js','utf8'),c);
test('duplicate explanations and shared illustrations retain all identities, equations and first-occurrence order',()=>{
 const structures=[];
 for(const lang of ['chn','eng']){
  const points=numberKnowledgePoints(c.window.DSE_TEXTBOOK_DATA.languages[lang]);const cards=sharedFigureCards(points);
  assert.deepEqual(cards.flatMap(p=>(p.members||[p]).map(m=>m.sequence)).sort((a,b)=>a-b),points.map(p=>p.sequence).sort((a,b)=>a-b));
  const positions=new Map(points.map((p,i)=>[p.sequence,i]));
  const firsts=cards.map(p=>Math.min(...(p.members||[p]).map(m=>positions.get(m.sequence))));
  assert.deepEqual(firsts,[...firsts].sort((a,b)=>a-b));
  for(const p of cards){
   const members=p.members||[p];
   assert.equal(new Set(members.map(m=>m.code)).size,1);
   assert.equal(new Set(members.map(m=>m.book_key)).size,1);
   if(members.some(m=>m.is_governing_law))assert.equal(cardSections(p).length,1, 'Governing-law topic stays independent');
   assert.equal(new Set(cardFigures(p).map(f=>f.src)).size,cardFigures(p).length);
   assert.deepEqual(cardSections(p).flatMap(s=>s.members.map(m=>m.sequence)).sort((a,b)=>a-b),members.map(m=>m.sequence).sort((a,b)=>a-b));
   assert.deepEqual(cardSections(p).flatMap(s=>s.members.flatMap(m=>m.formula_latex||[])).sort(),members.flatMap(m=>m.formula_latex||[]).sort());
   assert.ok(!(p.related_cards||[]).some(l=>p.members?.some(m=>m.sequence===l.sequence)));
  }
  for(const group of duplicateCardGroups){
   const card=cards.find(p=>(p.members||[p]).some(m=>m.sequence===group[0]));
   assert.ok(group.every(id=>(card.members||[card]).some(m=>m.sequence===id)));
   const originals=group.map(id=>points.find(p=>p.sequence===id));
   assert.equal(new Set(originals.map(p=>p.card_title)).size,1);
   assert.equal(new Set(originals.map(p=>p.card_summary)).size,1);
  }
  const summaries=cards.flatMap(p=>cardSections(p).map(s=>JSON.stringify([s.point.book_key,s.point.code,s.point.card_summary])));
  assert.equal(new Set(summaries).size,summaries.length, "No repeated explanation within a chapter");
  const lightYear=cards.find(p=>p.sequence===248);
  assert.deepEqual(lightYear.members.map(m=>m.sequence),[248,249]);
  assert.equal(cardSections(lightYear).length,1);
  assert.ok(lightYear.members.some(m=>m.formula_latex?.length));
  const atomic=cards.find(p=>p.members?.some(m=>m.sequence===233));
  assert.ok(cards.some(p=>p.sequence===216&&!p.members), 'Eddy currents are a separate topic despite a reused flux illustration');
  assert.deepEqual(atomic.members.map(m=>m.sequence),[232,233,234]);
  assert.equal(cardFigures(atomic).length,1);assert.equal(cardSections(atomic).length,3);
  structures.push(cards.map(p=>(p.members||[p]).map(m=>m.sequence)));
 }
 assert.deepEqual(structures[0],structures[1]);
});

test('a.c. and d.c. generators remain independent cards with matching textbook diagrams',()=>{
 for(const lang of ['chn','eng']){
  const points=numberKnowledgePoints(c.window.DSE_TEXTBOOK_DATA.languages[lang]);
  const cards=sharedFigureCards(points),dc=cards.find(p=>p.sequence===215),ac=cards.find(p=>p.sequence===417);
  assert.ok(dc&&!dc.members);assert.ok(ac&&!ac.members);
  assert.equal(dc.number,'4.7.4');assert.equal(ac.number,'4.7.5');
  assert.equal(cardFigures(dc)[0].figure_label,'7.2c');assert.equal(cardFigures(dc)[0].page,16);
  assert.equal(cardFigures(ac)[0].figure_label,'7.2e');assert.equal(cardFigures(ac)[0].page,17);
  assert.notEqual(cardFigures(dc)[0].src,cardFigures(ac)[0].src);
  assert.equal(cardFigures(dc)[0].language,lang);assert.equal(cardFigures(ac)[0].language,lang);
 }
});
