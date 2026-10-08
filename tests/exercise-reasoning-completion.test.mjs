import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
test('all bilingual exercise identities match and every MC has teaching reasoning',()=>{
 const ids={};
 for(const lang of ['chn','eng']){
  const index=read(`assets/textbook-exercises/index-${lang}.json`);ids[lang]=[];
  for(const book of index.books)for(const chapter of book.chapters){
   const records=read(`assets/textbook-exercises/${lang}/${chapter.id}.json`);
   for(const [id,q] of Object.entries(records)){
    ids[lang].push(id);assert.ok(q.question.trim()&&q.answer.trim(),id);
    if(q.kind==='multiple-choice')assert.ok(q.reasoning.replace(/<[^>]*>/g,'').trim().length>1 || /<img\b[^>]*src=/.test(q.reasoning),`${lang} ${id}: text or worked diagram required`);
   }
  }
  assert.equal(ids[lang].length,979);
  assert.deepEqual([...ids[lang]].sort(),index.questions.map(q=>q.id).sort());
 }
 assert.deepEqual(ids.chn.sort(),ids.eng.sort());
});
test('supplements preserve source answers and provide both languages without overwriting provenance',()=>{
 const additions=read('scripts/exercise-reasoning-supplements.json'),baseline=read('scripts/exercise-reasoning-baseline.json');
 assert.equal(Object.keys(additions).length,77);
 for(const [id,item] of Object.entries(additions))for(const lang of ['chn','eng']){
  const q=read(`assets/textbook-exercises/${lang}/${id.split('-')[1]}.json`)[id];
  assert.ok(item[lang].length>=2);assert.equal(hash(q.answer),baseline[id][lang].answer_sha256);
  assert.equal(q.source.sha256,baseline[id][lang].source_sha256);
  assert.doesNotMatch(q.reasoning,/<script|javascript:|待補|TODO/i);
  if(id!=='tb-202-5')assert.equal(hash(q.question),baseline[id][lang].question_sha256);
 }
});
test('motion graphs retain full axes and ambiguous source answers retain caveats in both languages',()=>{
 for(const lang of ['chn','eng']){
  assert.match(read(`assets/textbook-exercises/${lang}/202.json`)['tb-202-5'].question,/202-5-complete-axes.png/);
  for(const id of ['tb-E301-4','tb-E301-5']){
   const q=read(`assets/textbook-exercises/${lang}/E301.json`)[id];
   assert.match(q.reasoning,/D/);assert.match(q.reasoning,lang==='chn'?/體積|比容/:/volume/);
  }
 }
});
