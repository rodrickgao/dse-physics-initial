import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { numberKnowledgePoints } from '../src/lib/knowledge-numbering.js';

test('all bilingual source IDs keep their card number in the exported data', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('textbook-data.js', 'utf8'), context);
  const langs = context.window.DSE_TEXTBOOK_DATA.languages;
  for (const edition of Object.values(langs)) {
    const points = edition;
    const numbered = numberKnowledgePoints(points);
    assert.equal(numbered.length, 413);
    assert.equal(new Set(numbered.map(p => p.number)).size, 281);
    const original = new Map(points.map(p => [p.sequence, p]));
    numbered.forEach(p => { assert.equal(p.number, original.get(p.sequence).number); });
    assert.equal(numbered[0].number, '1.1.1');
    assert.equal(numbered[2].number, '1.2.1');
    assert.equal(numbered.find(p => p.code === '3B04').number, '3.4.1');
  }
  assert.deepEqual(Array.from(langs.eng, p => p.number), Array.from(langs.chn, p => p.number));
});

test('download library exposes only original papers with honest language coverage', () => {
  const { files, unavailable } = JSON.parse(fs.readFileSync('downloads/catalog.json', 'utf8'));
  assert.equal(files.length, 78);
  assert.equal(new Set(files.map(f => f.url)).size, 78);
  assert.equal(unavailable.length, 6);
  for (const lang of ['eng', 'chn']) {
    assert.equal(files.filter(f => f.language === lang && f.kind === 'knowledge').length, 0);
    for (let year = 2012; year <= 2025; year++) for (const paper of ['paper-1a', 'paper-1b', 'paper-2']) {
      const missing = (lang === 'eng' && year === 2024) || (lang === 'chn' && year === 2025);
      assert.equal(files.filter(f => f.language === lang && f.year === year && f.paper === paper).length, missing ? 0 : 1);
    }
  }
  for (const f of files) {
    const bytes = fs.readFileSync(f.url);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), f.sha256);
    if (f.kind === 'paper') {
      assert.equal(f.edition, 'original');
      assert.ok(f.url.startsWith('downloads/originals/'));
      assert.ok(f.year <= 2025);
      assert.ok(!/ans|solution|per\.pdf/i.test(f.source));
      if (!f.sourcePages) assert.equal(f.sha256, f.sourceSha256);
      if (f.year === 2024) assert.deepEqual(f.sourcePages, {'paper-1a':[6,21], 'paper-1b':[22,40], 'paper-2':[41,57]}[f.paper]);
    }
  }
  for (const lang of ['eng','chn']) assert.deepEqual((fs.existsSync('downloads/' + lang) ? fs.readdirSync('downloads/' + lang) : []).filter(f => f.endsWith('.pdf')), []);
});
