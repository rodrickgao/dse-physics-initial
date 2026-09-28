import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { protectStudyFiles } from '../server/premium.mjs';

function resource(url,active=false){
 const headers={};let status=200,body='';
 const handled=protectStudyFiles({url},{setHeader:(k,v)=>headers[k]=v,writeHead:(s,h)=>{status=s;Object.assign(headers,h);},end:v=>{body=v;}},active);
 return {handled,status,headers,body};
}
test('all bilingual textbook model answers are public; separate explanations and links require membership',()=>{
 const freeMedia=new Set(),paidMedia=new Set();let count=0,explained=0;
 const media=(html,set)=>{for(const m of String(html||'').matchAll(/src="(assets\/textbook-exercises\/media\/[^"?#]+)"/g))set.add('/'+m[1]);};
 for(const lang of ['chn','eng']){
  const path=`/assets/textbook-exercises/index-${lang}.json`,source=JSON.parse(readFileSync('.'+path,'utf8'));
  const free=resource(path),index=JSON.parse(free.body);
  assert.equal(index.questions.length,979);assert.equal(free.headers.Vary,'Cookie');assert.match(free.headers['Cache-Control'],/no-store/);
  assert.ok(index.questions.every(q=>q.knowledge.length===0&&!('section'in q)));
  assert.ok(index.books.flatMap(b=>b.chapters).every(c=>c.sections.length===0));
  assert.deepEqual(JSON.parse(resource(path,true).body),source);
  for(const chapter of source.books.flatMap(b=>b.chapters)){
   const path=`/assets/textbook-exercises/${lang}/${chapter.id}.json`,original=JSON.parse(readFileSync('.'+path,'utf8'));
   const records=JSON.parse(resource(path).body);assert.deepEqual(JSON.parse(resource(path,true).body),original);
   for(const [key,record]of Object.entries(original)){
    count++;assert.equal(records[key].question,record.question,key);assert.equal(records[key].answer,record.answer,key);
    assert.ok(!('reasoning'in records[key]),key);assert.equal(records[key].hasReasoning,!!record.reasoning,key);
    if(record.reasoning)explained++;
    media(record.question,freeMedia);media(record.answer,freeMedia);media(record.reasoning,paidMedia);
   }
  }
 }
 assert.equal(count,1958);assert.ok(explained>0);
 for(const path of freeMedia)assert.equal(resource(path).handled,false,path);
 for(const path of paidMedia){assert.equal(resource(path,true).handled,false,path);if(!freeMedia.has(path))assert.equal(resource(path).status,403,path);}
 for(const path of ['/dist/assets/textbook-exercises/chn/201.json','/@fs/any/assets/textbook-exercises/chn/201.json','/assets/textbook-exercises/unknown.json'])assert.equal(resource(path).status,403,path);
});
