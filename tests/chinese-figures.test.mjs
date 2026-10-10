import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
import {sharedFigureCards,cardFigures} from '../src/lib/shared-figure-cards.js';
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('textbook-data.js','utf8'),ctx);
test('Chinese cards use complete Chinese-edition figure assets and preserve bilingual card identities',()=>{
 const data=ctx.window.DSE_TEXTBOOK_DATA.languages;
 const manifest=JSON.parse(fs.readFileSync('scripts/chinese-figure-manifest.json','utf8'));
 const expected=new Map(manifest.map(f=>[f.src,f]));const seen=new Set();
 for(const point of data.chn)for(const f of cardFigures(point)){
  assert.equal(f.language,'chn',f.id);assert.ok(expected.has(f.src),f.src);
  assert.equal(f.source,data.chn.find(point=>point.code===f.code).source);assert.ok(f.bbox_fraction.every(n=>n>=0&&n<=1));
  const image=fs.readFileSync(f.src);assert.equal(image.readUInt32BE(16),f.width);assert.equal(image.readUInt32BE(20),f.height);
  assert.notEqual(createHash('sha256').update(image).digest('hex'),createHash('sha256').update(fs.readFileSync(expected.get(f.src).previous_src)).digest('hex'));
  seen.add(f.src);
 }
 assert.equal(seen.size,expected.size);
 assert.deepEqual(sharedFigureCards(data.chn).map(p=>(p.members||[p]).map(m=>m.sequence)),sharedFigureCards(data.eng).map(p=>(p.members||[p]).map(m=>m.sequence)));
 for(const point of data.eng)for(const f of cardFigures(point))assert.ok(!f.src.includes('figures-chn/'));
});
