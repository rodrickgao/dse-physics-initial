import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadExample } from '../src/lib/textbook-examples.js';
import { exampleEntries } from '../src/lib/textbook-examples.js';
import { printableQuestion } from '../src/lib/study-content.js';
const read = path => JSON.parse(fs.readFileSync(path,'utf8'));
const base = 'assets/textbook-examples';

test('Chinese examples cover every bilingual identity with original questions and separate solutions',()=>{
  const zh=read(`${base}/index-chn.json`), en=read(`${base}/index-eng.json`);
  assert.equal(zh.contentLanguage,'chn');
  assert.deepEqual(zh.questions.map(q=>q.id),en.questions.map(q=>q.id));
  for(const book of zh.books) for(const chapter of book.chapters) {
    const records=read(`${base}/chn/${chapter.id}.json`);
    assert.equal(Object.keys(records).length,chapter.count);
    for(const q of Object.values(records)) {
      assert.match(q.title,/[\u3400-\u9fff]/,q.id);
      assert.ok(q.question && q.answer && q.source.sha256,q.id);
      assert.equal(q.format,'editable-text');
      assert.match(q.question.replace(/<[^>]+>/g,''),/[\u3400-\u9fff]/,q.id);
      assert.ok(q.answer.trim(),q.id);
      assert.ok(/<math|<img|[\u3400-\u9fff]/.test(q.answer),q.id);
      const english=read(`${base}/eng/${chapter.id}.json`)[q.id];
      assert.equal(Boolean(q.think),Boolean(english.think),q.id);
      assert.equal(Boolean(q.thinkAnswer),Boolean(english.thinkAnswer),q.id);
      assert.ok(!/data-math=|katex-error|\(cid:/.test(JSON.stringify(q)));
      assert.ok(!/-question-\d+\.jpg|-answer-\d+\.jpg/.test(q.question+q.answer));
      assert.ok(q.source.segments.filter(s=>s.kind==='question').every(s=>!/題\s*解/.test(s.text)),q.id);
      for(const field of ['question','answer','tips']) for(const [,src] of q[field].matchAll(/src="([^"]+)"/g)) {
        assert.ok(src.startsWith(`${base}/chn/figures/`) || src.startsWith(`${base}/media/`) || src.startsWith(`${base}/figures-chn/`));assert.ok(fs.existsSync(src),src);
      }
      const entry=exampleEntries().find(e=>e.key===q.id);
      const practice=printableQuestion(entry,q,{language:'chn',mode:'questions'});
      assert.ok(practice.includes(q.question));assert.ok(!practice.includes(q.answer));
    }
  }
});

test('example loading respects language and rejects unsafe keys before fetching',async()=>{
  const original=globalThis.fetch;const paths=[];
  globalThis.fetch=async path=>{paths.push(path);return {ok:true,json:async()=>({id:'ex-101-1'})};};
  try {
    await loadExample('ex-101-1','chn');await loadExample('ex-101-1','eng');
    assert.deepEqual(paths,['/api/content/question?id=ex-101-1&language=chn','/api/content/question?id=ex-101-1&language=eng']);
    await assert.rejects(loadExample('../../private','chn'));
    assert.equal(paths.length,2);
  } finally {globalThis.fetch=original;}
});
