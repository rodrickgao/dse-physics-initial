import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import vm from 'node:vm';
const catalog=JSON.parse(fs.readFileSync('src/lib/textbook-downloads.json','utf8'));
test('all 46 chapters retain their original bilingual watermarked PDF source files',()=>{
 const c={window:{}};vm.runInNewContext(fs.readFileSync('textbook-data.js','utf8'),c);
 for(const language of ['chn','eng']){
  const points=c.window.DSE_TEXTBOOK_DATA.languages[language].filter(p=>p.sequence<=365);
  const codes=[...new Set(points.map(p=>p.code))];assert.equal(codes.length,46);assert.deepEqual(Object.keys(catalog[language]).sort(),codes.sort());
  for(const code of codes){
   const file=catalog[language][code];assert.equal(file.source,language==='chn'?'知识点（中文版）.pdf':'知识点（英文版）.pdf');assert.ok(file.pages>0);assert.ok(file.filename.includes('知识点'));
   assert.equal(file.url,`assets/textbook/pdfs/${language}/${code}.pdf`);
   const bytes=fs.readFileSync(file.url);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.equal(bytes.length,file.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);
  }
 }
});
