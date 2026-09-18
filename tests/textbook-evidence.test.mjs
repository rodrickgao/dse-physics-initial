import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {numberKnowledgePoints} from '../src/lib/knowledge-numbering.js';
const ctx={window:{}};
for(const name of ['textbook-data.js','knowledge-network-data.js','paper2-knowledge-data.js','statistics-data.js'])vm.runInNewContext(fs.readFileSync(name,'utf8'),ctx);
const d=ctx.window.DSE_TEXTBOOK_DATA,n={...ctx.window.DSE_KNOWLEDGE_NETWORK,...ctx.window.DSE_PAPER2_KNOWLEDGE};
const report=JSON.parse(fs.readFileSync('scripts/textbook-evidence-update.json','utf8'));
test('stable identities follow textbook order and readable cards retain source provenance',()=>{
 for(const lang of ['eng','chn']){
  const points=d.languages[lang];assert.equal(points.length,410);assert.equal(new Set(points.map(p=>p.sequence)).size,410);
  const all=numberKnowledgePoints(points);
  assert.deepEqual(all.map(p=>p.sequence).sort((a,b)=>a-b),Array.from(points,p=>p.sequence).sort((a,b)=>a-b));
  assert.deepEqual(all.map(p=>p.sequence),numberKnowledgePoints(d.languages[lang==='eng'?'chn':'eng']).map(p=>p.sequence));
  assert.ok(all.findIndex(p=>p.sequence===415)<all.findIndex(p=>p.sequence===31));
  assert.ok(all.findIndex(p=>p.sequence===381)<all.findIndex(p=>p.sequence===379));
  for(let i=1;i<all.length;i++){
   const a=all[i-1].textbook_order,b=all[i].textbook_order;
   assert.ok(a.chapter<b.chapter||(a.chapter===b.chapter&&(a.page<b.page||(a.page===b.page&&a.y<=b.y))));
  }
  for(const p of points.filter(p=>p.sequence>365)){
   assert.equal(p.importance,null);assert.equal(p.source_language,'eng');assert.equal(p.box,null);
   assert.ok(p.source_excerpts.length);assert.equal(p.content,p.source_excerpts.map(s=>s.text).join('\n\n'));
   assert.ok(p.card_summary.length>40&&!p.card_summary.includes('\n'));
   assert.equal(p.card_format,'paragraph-and-diagrams');
   for(const s of p.source_excerpts)assert.ok(s.source&&s.page>0&&s.printed_page>0&&s.text.length>15);
   for(const f of p.figures){const png=fs.readFileSync(f.src);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),f.width);assert.equal(png.readUInt32BE(20),f.height);}
   const other=d.languages[lang==='eng'?'chn':'eng'].find(q=>q.sequence===p.sequence);assert.deepEqual(p.source_excerpts,other.source_excerpts);
  }
 }
});
test('knowledge cards have no cross-card relations and question evidence stays independent',()=>{
 const points=new Map(d.languages.eng.map(p=>[p.sequence,p]));
 for(const lang of Object.values(d.languages))for(const p of lang)assert.equal((p.related_cards||[]).length,0);
 for(const [key,e] of Object.entries(n))for(const l of e.links){assert.ok(!points.get(l.sequence).is_governing_law);if(key.includes('|paper-2|'))assert.equal(l.bookKey,'elective-'+key.split('|')[2].split('.')[0]);}
 assert.ok(n['2021|paper-1a|21'].relatedLinks.some(l=>l.sequence===160));
 assert.ok(!n['2021|paper-1a|21'].links.some(l=>l.sequence===160));
});
test('withdrawn proposals and mismatched question candidates are not adopted',()=>{
 for(const id of ['N05','N17','N25','N26','N27','N47'])assert.ok(!d.languages.eng.some(p=>p.proposal_id===id));
 assert.ok(d.languages.eng.find(p=>p.sequence===314).textbook_supplements.some(s=>s.id==='N27'));
 for(const s of report.skipped)assert.ok(!n[s.key].links.some(l=>l.sequence===report.ids[s.id]),s.id+' '+s.key);
 for(const c of report.changes){const field=c.role==='background'?'relatedLinks':'links';const link=n[c.key][field].find(l=>l.sequence===c.sequence);assert.ok(link.evidence.length>10);}
});
