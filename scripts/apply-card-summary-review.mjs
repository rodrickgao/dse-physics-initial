import fs from 'node:fs';
import vm from 'node:vm';
const site=new URL('../',import.meta.url);
const review=JSON.parse(fs.readFileSync(new URL('card-summary-review.json',import.meta.url),'utf8'));
const filename=new URL('textbook-data.js',site),context={window:{}};
vm.runInNewContext(fs.readFileSync(filename,'utf8'),context);
const data=context.window.DSE_TEXTBOOK_DATA;
let changed=0;
const coverageFile=new URL('card-coverage-review.json',import.meta.url);
if(fs.existsSync(coverageFile)){
 const coverage=JSON.parse(fs.readFileSync(coverageFile,'utf8'));
 for(const addition of coverage.additions||[])for(const language of ['chn','eng']){
  if(!data.languages[language].some(p=>p.sequence===addition.sequence)){
   data.languages[language].push(addition[language]);changed++;
  }
 }
 for(const [sequence,editions] of Object.entries(coverage.overrides||{}))for(const language of ['chn','eng']){
  const point=data.languages[language].find(p=>p.sequence===Number(sequence));
  if(!point)throw Error(`Missing coverage point ${language} #${sequence}`);
  for(const [field,value] of Object.entries(editions[language])){
   if(JSON.stringify(point[field])!==JSON.stringify(value)){point[field]=value;changed++;}
  }
 }
 if(data.pointCount!==data.languages.chn.length){data.pointCount=data.languages.chn.length;changed++;}
 const counts={};for(const p of data.languages.eng)counts[p.category]=(counts[p.category]||0)+1;
 if(JSON.stringify(data.classification.categoryCounts)!==JSON.stringify(counts)){data.classification.categoryCounts=counts;changed++;}
}
for(const language of ['chn','eng'])for(const [sequence,edition]of Object.entries(review.revisions)){
 const point=data.languages[language].find(p=>p.sequence===Number(sequence));
 if(!point)throw Error(`Missing reviewed point ${language} #${sequence}`);
 if(point.card_summary!==edition[language]){point.card_summary=edition[language];changed++;}
}
if(changed)fs.writeFileSync(filename,'window.DSE_TEXTBOOK_DATA = '+JSON.stringify(data)+';\n');
console.log(JSON.stringify({reviewed:Object.keys(review.revisions).length,changed}));
if(fs.existsSync(coverageFile))await import('./apply-card-coverage-links.mjs');
