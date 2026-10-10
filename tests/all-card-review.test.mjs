import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import katex from 'katex';
const site=new URL('../',import.meta.url),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('textbook-data.js',site),'utf8'),ctx);
const data=ctx.window.DSE_TEXTBOOK_DATA;
test('every card has readable paragraphs; reviewed cards retain complete typeset equations and traceable diagram assets',()=>{
 for(const lang of ['chn','eng']){
  assert.equal(data.languages[lang].length,411);
  for(const p of data.languages[lang]){
   const label=`${lang} #${p.sequence}`;
   assert.ok(p.card_summary.length>=40,label);
   assert.ok(!/[\r\uFFFD]/.test(p.card_summary),label);
   assert.ok(p.card_summary.split('\n\n').every(paragraph=>paragraph.trim()&&!paragraph.includes('\n')),label);
   assert.equal(p.card_format,'paragraph-and-diagrams',label);
   if(p.sequence<=365){assert.ok(p.card_title,label);assert.equal(p.card_review,'2026-09-18-all-original-points');}
   for(const latex of [...p.formula_latex||[],...Array.from(p.card_summary.matchAll(/\\\(([\s\S]*?)\\\)/g),m=>m[1])])katex.renderToString(latex,{throwOnError:true,strict:'error',trust:false});
   assert.equal((p.card_summary.match(/\\\(/g)||[]).length,(p.card_summary.match(/\\\)/g)||[]).length,label);
   for(const f of p.review_figures){
    assert.ok(f.source&&f.page&&f.caption,label);
    const png=fs.readFileSync(new URL(f.src,site));
    assert.equal(png.subarray(1,4).toString(),'PNG',f.src);
    assert.equal(png.readUInt32BE(16),f.width,f.src);
    assert.equal(png.readUInt32BE(20),f.height,f.src);
   }
  }
 }
});
test('essential explanatory diagrams are available without text-heavy page screenshots',()=>{
 const p=id=>data.languages.chn.find(x=>x.sequence===id);
 for(const [id,fig]of [[5,'conduction'],[6,'convection'],[19,'heating-curve'],[73,'work-angle'],[120,'convex-images'],[138,'wave-refraction'],[208,'motor-commutator'],[237,'decay-curve'],[307,'photoelectric-stop'],[341,'cochlea-frequency']])assert.ok(p(id).review_figures.some(f=>f.id===fig));
 assert.ok(!p(279).review_figures.some(f=>f.id==='heat-pump-energy'));
 assert.ok(p(279).review_figures.some(f=>f.id==='N39-1'));
});
