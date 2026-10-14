import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMistakes } from '../src/lib/mistake-analysis.js';

const points = [{sequence:1,code:'101',chapter:'Heat'},{sequence:2,code:'101',chapter:'Heat'},{sequence:3,code:'201',chapter:'Motion'}];
const entry = (key,links,extra={}) => ({key,network:{links},paperIndex:0,...extra});
test('knowledge distribution uses one main displayed card per question and keeps unknown items without duplicate counting',()=>{
 const image={id:'velocity-time',src:'shared.png'};
 const topics=[{sequence:10,code:'202',book_key:'compulsory-2',card_summary_language:'eng',number:'2.2.1',card_title:'Velocity',review_figures:[image]},{sequence:11,code:'202',book_key:'compulsory-2',card_title:'Acceleration',review_figures:[image]},{sequence:12,code:'201',card_title:'Distance'}];
 const first=entry('one',[{sequence:12},{sequence:11}],{primaryChapterCode:'202'});
 const result=analyzeMistakes([first,first,entry('two',[{sequence:10},{sequence:11}],{paperIndex:1}),entry('unknown',[])],topics);
 assert.equal(result.knowledgeDistribution.reduce((n,row)=>n+row.keys.length,0),3);
 assert.equal(result.pointCount,2,'related knowledge counts displayed cards, including merged source points');
 const merged=result.knowledgeDistribution.find(row=>row.sequence===10);
 assert.deepEqual(merged.keys,['one','two']);assert.equal(merged.multipleChoice,1);assert.equal(merged.structured,1);
 assert.equal(merged.name,'Velocity-time graphs and motion');
 assert.deepEqual(result.knowledgeDistribution.find(row=>row.sequence===0).keys,['unknown']);
});
test('chapter totals count each question once, respect primary links, and include unclassified questions',()=>{
 const entries=[entry('a',[{sequence:1},{sequence:3,type:'primary'},{sequence:3}]),entry('b',[{sequence:1},{sequence:2}],{paperIndex:1}),entry('c',[])];
 const result=analyzeMistakes([...entries,entries[0]],points,'eng');
 assert.equal(result.chapters.reduce((n,r)=>n+r.keys.length,0),3);
 assert.deepEqual(result.chapters.find(r=>r.code==='201').keys,['a']);
 assert.equal(result.chapters.find(r=>r.code==='101').structured,1);
 assert.equal(result.chapters.find(r=>r.code==='unclassified').name,'Unclassified');
 assert.deepEqual(result.recommendations.find(r=>r.sequence===3).keys,['a']);
 assert.equal(result.recommendations.find(r=>r.sequence===1).keys.length,2);
});
test('free and member chapter distributions match, recommendations update when mastered questions leave',()=>{
 const entries=[entry('a',[{sequence:3}],{primaryChapterCode:'201',sortChapter:'101'}),entry('b',[{sequence:1}],{primaryChapterCode:'101'}),entry('c',[{sequence:2}],{primaryChapterCode:'101'})];
 const result=analyzeMistakes(entries,points);
 assert.deepEqual(analyzeMistakes(entries.map(e=>({...e,network:{links:[]}})),points).chapters,result.chapters);
 const next=analyzeMistakes(entries.filter(e=>e.key!=='b'),points);
 assert.ok(!next.recommendations.some(r=>r.sequence===1));
 assert.equal(next.chapters.reduce((n,r)=>n+r.keys.length,0),2);
 assert.deepEqual(analyzeMistakes([],points),{chapters:[],recommendations:[],pointCount:0,knowledgeDistribution:[]});
});
