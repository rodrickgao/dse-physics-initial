import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readRoute,pageHash,exerciseBookFromHash} from '../src/lib/study-state.js';
const base='assets/textbook-examples';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
test('all verified examples retain chapter identity, structured content, math and figures',()=>{
  const index=read(`${base}/index-eng.json`),zh=read(`${base}/index-chn.json`);
  assert.equal(index.books.length,9);assert.equal(index.books.flatMap(b=>b.chapters).length,46);
  assert.equal(index.questions.length,373);assert.equal(new Set(index.questions.map(q=>q.id)).size,373);
  assert.deepEqual(zh.questions.map(q=>q.id),index.questions.map(q=>q.id));
  let think=0,math=0,images=0;
  for(const b of index.books)for(const c of b.chapters){
    const records=read(`${base}/eng/${c.id}.json`);assert.equal(Object.keys(records).length,c.count);
    for(const q of Object.values(records)){
      assert.ok(q.question&&q.answer&&q.source.sha256,q.id);
      assert.equal(!!q.think,!!q.thinkAnswer,q.id);think+=!!q.think;
      assert.deepEqual(readRoute(pageHash('examples',q.id)),{page:'examples',question:q.id});
      for(const field of ['question','answer','tips','think','thinkAnswer']){
        assert.doesNotMatch(q[field],/<script|\bon\w+\s*=|javascript:|file:\/\//i);
        math+=(q[field].match(/<math /g)||[]).length;
        for(const [,src] of q[field].matchAll(/<img[^>]+src="([^"]+)"/g)){assert.ok(src.startsWith(base+'/media/'));assert.ok(fs.existsSync(src));images++;}
      }
    }
  }
  assert.equal(think,51);assert.ok(math>4000);assert.ok(images>=450);
  assert.match(read(`${base}/eng/202.json`)['ex-202-12'].answer,/msup/);
});
test('book routes survive reloads and unsafe example keys are rejected',()=>{
  assert.equal(pageHash('examples','',{book:'elective-2'}),'#examples?book=elective-2');
  assert.equal(exerciseBookFromHash('#examples?book=elective-2'),'elective-2');
  assert.equal(readRoute('#examples?question=../../private').question,'');
  assert.equal(readRoute('#examples?question=ex-E999-1').question,'');
});
