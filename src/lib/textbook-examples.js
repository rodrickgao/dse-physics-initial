import exampleKnowledge from './textbook-example-knowledge.json' with { type: 'json' };
export function exampleEntries(points=[],language='chn') {
 const pointMap=new Map(points.map(p=>[Number(p.sequence),p]));
 return Object.entries(exampleKnowledge).map(([key,sequences])=>{
  const [,chapter,number]=/^ex-(.+)-(\d+)$/.exec(key);
  return {key,id:key,source:'examples',exerciseChapter:chapter,chapter,number,knowledge:sequences,year:{year:0,id:''},paperIndex:1,questionIndex:Number(number),question:{label:`E${number}`,kind:'structured'},paper:{title:language==='eng'?'Textbook examples':'课本例题'},network:{links:sequences.map(sequence=>({sequence,chapterEn:pointMap.get(sequence)?.chapter,chapterZh:pointMap.get(sequence)?.chapter}))}};
 });
}
export function relatedExamples(sequences) {
 const wanted=new Set(sequences.map(Number));
 return exampleEntries().filter(q=>q.knowledge.some(s=>wanted.has(s))).sort((a,b)=>a.chapter.localeCompare(b.chapter,'en',{numeric:true})||Number(a.number)-Number(b.number));
}
export async function loadExample(id) {
 const match=/^ex-(E?[1-5](?:A|B)?\d{2})-\d+$/.exec(id);
 if(!match)throw new Error('Invalid example');
 const response=await fetch(`assets/textbook-examples/eng/${match[1]}.json`);
 if(!response.ok)throw new Error('Example unavailable');
 const data=await response.json();if(!data[id])throw new Error('Example missing');return data[id];
}
