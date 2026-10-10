import fs from 'node:fs';
import vm from 'node:vm';
const site=new URL('../',import.meta.url);
const review=JSON.parse(fs.readFileSync(new URL('card-summary-review.json',import.meta.url),'utf8'));
const filename=new URL('textbook-data.js',site),context={window:{}};
vm.runInNewContext(fs.readFileSync(filename,'utf8'),context);
const data=context.window.DSE_TEXTBOOK_DATA;
let changed=0;
for(const language of ['chn','eng'])for(const [sequence,edition]of Object.entries(review.revisions)){
 const point=data.languages[language].find(p=>p.sequence===Number(sequence));
 if(!point)throw Error(`Missing reviewed point ${language} #${sequence}`);
 if(point.card_summary!==edition[language]){point.card_summary=edition[language];changed++;}
}
if(changed)fs.writeFileSync(filename,'window.DSE_TEXTBOOK_DATA = '+JSON.stringify(data)+';\n');
console.log(JSON.stringify({reviewed:Object.keys(review.revisions).length,changed}));
