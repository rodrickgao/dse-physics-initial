import test from 'node:test';
import assert from 'node:assert/strict';
import {teacherQuestionLocation} from '../src/lib/teacher-question-location.js';
import {questions,points} from '../server/catalog.mjs';
test('every current question restores its exact source, year/paper or textbook chapter without changing its identity',()=>{
 let count=0;
 for(const question of questions.values()){
  const location=teacherQuestionLocation(question.key);assert.ok(location,question.key);
  if(question.key.includes('|')){const [year,paper]=question.key.split('|');assert.deepEqual(location,{source:'past-paper',year,paper});}
  else{const chapter=question.key.split('-')[1];assert.equal(location.source,question.key.startsWith('ex-')?'examples':'textbook');assert.equal(location.chapterCode,chapter);assert.equal(location.bookKey,[...points.values()].find(point=>point.code===chapter)?.book_key);}
  count++;
 }
 assert.equal(count,2468);
});
test('paper 2 subquestion IDs and compulsory 3A/3B references retain their picker path',()=>{
 assert.deepEqual(teacherQuestionLocation('2012|paper-2|1.3'),{source:'past-paper',year:'2012',paper:'paper-2'});
 assert.deepEqual(teacherQuestionLocation('ex-3B04-1'),{source:'examples',bookKey:'compulsory-3',chapterCode:'3B04'});
 assert.deepEqual(teacherQuestionLocation('tb-E403-15'),{source:'textbook',bookKey:'elective-4',chapterCode:'E403'});
 for(const value of ['', 'knowledge-48', '2025|report|1', 'ex-invalid-1'])assert.equal(teacherQuestionLocation(value),null);
});
