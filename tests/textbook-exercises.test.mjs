import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { relatedExercises, exerciseLocation } from '../src/lib/textbook-exercises.js';
import { readRoute, pageHash } from '../src/lib/study-state.js';
const base = 'assets/textbook-exercises';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const indices = Object.fromEntries(['eng','chn'].map(lang => [lang, read(`${base}/index-${lang}.json`)]));
const sources = read('scripts/textbook-exercise-sources.json');
const context = {window:{}}; vm.runInNewContext(fs.readFileSync('textbook-data.js','utf8'),context);
test('all 92 source chapters are imported with matching bilingual question identities and original numbering', () => {
  assert.equal(sources.length,92);
  assert.deepEqual(indices.eng.questions.map(q=>q.id).sort(),indices.chn.questions.map(q=>q.id).sort());
  for (const lang of ['eng','chn']) {
    const index=indices[lang]; assert.equal(index.books.length,9); assert.equal(index.books.flatMap(b=>b.chapters).length,46);
    assert.equal(index.questions.length,979);
    const all=[];
    for (const book of index.books) for(const chapter of book.chapters) {
      const records=read(`${base}/${lang}/${chapter.id}.json`);
      assert.equal(Object.keys(records).length,sources.find(s=>s.language===lang&&s.chapter===chapter.id).questions);
      for(const section of chapter.sections) all.push(...section.questionIds);
      for(const q of Object.values(records)) {
        assert.equal(q.id,`tb-${chapter.id}-${q.number}`);
        assert.ok(q.question&&q.answer&&q.source.sha256);
        for(const field of ['question','answer','reasoning']) {
          assert.doesNotMatch(q[field],/<script|\bon\w+\s*=|javascript:|file:\/\/|[CD]:\\/i);
          assert.doesNotMatch(q[field],/[\uf000-\uf0ff]/,`${q.id}: undecoded Word Symbol glyph`);
          for(const [,src] of q[field].matchAll(/<img[^>]+src="([^"]+)"/g)) {
            assert.ok(src.startsWith(`${base}/media/`));assert.ok(fs.existsSync(src),`${q.id} ${src}`);
          }
        }
      }
    }
    assert.equal(new Set(all).size,979);assert.equal(all.length,979);
  }
});

test('kinetic theory working preserves multiplication, fractions, subscripts and the mean-square overbar',()=>{
  const answer=read(`${base}/eng/105.json`)['tb-105-20'].answer;
  assert.match(answer,/×/);
  assert.match(answer,/<mfrac>/);
  assert.match(answer,/<msub>/);
  assert.match(answer,/<mover accent="true">/);
  assert.match(answer,/<msup>/);
  assert.match(answer,/3×3\.5×8\.31×/);
});
test('all knowledge links resolve within the correct textbook and appear only in the exercise index',()=>{
  for(const lang of ['eng','chn']) {
    const index=indices[lang]; const points=new Map(context.window.DSE_TEXTBOOK_DATA.languages[lang].map(p=>[p.sequence,p]));
    for(const q of index.questions) {
      const location=exerciseLocation(index,q.id);assert.ok(location?.section);
      assert.ok(q.knowledge.length);
      for(const seq of q.knowledge) {
        assert.equal(points.get(seq)?.book_key,location.book.id,`${q.id}: ${seq}`);
        assert.ok(relatedExercises(index,[seq]).some(item=>item.id===q.id));
      }
      assert.deepEqual(readRoute(pageHash('exercises',q.id)),{page:'exercises',question:q.id});
    }
  }
  assert.equal(readRoute('#exercises?question=../../private').question,'');
  assert.equal(readRoute('#papers?question=tb-101-1').question,'');
});
test('source corrections and bilingual differences remain explicit instead of silently copying English answers',()=>{
  const en=read(`${base}/eng/3A03.json`),zh=read(`${base}/chn/3A03.json`);
  assert.match(zh['tb-3A03-8'].answer,/C.*更正/);
  assert.match(zh['tb-3A03-9'].answer,/沒有正確選項/);
  assert.notEqual(en['tb-3A03-9'].answer,zh['tb-3A03-9'].answer);
  assert.deepEqual(indices.eng.questions.find(q=>q.id==='tb-403-5').knowledge,[181,182]);
});
