import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import katex from 'katex';
import { sharedFigureCards, cardFigures } from '../src/lib/shared-figure-cards.js';
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('textbook-data.js','utf8'),ctx);
const points=ctx.window.DSE_TEXTBOOK_DATA.languages.eng;
const han=/[\u3400-\u9fff]/;
test('all 413 English knowledge points and shared cards have complete English display text',()=>{
 assert.equal(points.length,413);
 for(const p of points){
  assert.equal(p.card_summary_language,'eng');
  assert.ok(p.card_summary.length>100,`Incomplete summary: ${p.sequence}`);
  const visible=[p.card_title,p.card_summary,p.card_formula_notes,p.book,p.chapter,p.card_table?.label,...(p.card_table?.headers||[]),...(p.card_table?.rows||[]).flat(),...cardFigures(p).map(f=>f.caption),...(p.related_cards||[]).flatMap(l=>[l.type,l.note]),...(p.source_excerpts||[]).map(s=>s.text),...(p.textbook_supplements||[]).flatMap(s=>[s.explanation_en,...s.source_excerpts.map(e=>e.text)])].filter(Boolean);
  for(const text of visible){assert.ok(!han.test(text),`Chinese remains in ${p.sequence}: ${text}`);for(const m of text.matchAll(/\\\(([\s\S]*?)\\\)/g))assert.doesNotThrow(()=>katex.renderToString(m[1],{throwOnError:true}),`Invalid inline formula: ${p.sequence}`);}
 }
 for(const p of sharedFigureCards(points))assert.ok(!han.test(p.card_title),`Chinese group title ${p.sequence}`);
});
