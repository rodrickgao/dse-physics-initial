import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const review=JSON.parse(fs.readFileSync(path.join(site,'scripts/example-layout-review.json'),'utf8'));
const digest=s=>createHash('sha256').update(s).digest('hex');
export function restoreExampleLayoutSources(records,language){
 for(const [id,fields]of Object.entries(review[language]||{})){
  if(!records[id])continue;
  for(const [field,change]of Object.entries(fields)){
   const value=records[id][field],hash=digest(value);
   if(hash===change.afterSha256)records[id][field]=change.before;
   else if(hash!==change.beforeSha256)throw Error(`Recheck revised example: ${language}/${id}/${field}`);
  }
 }
 return records;
}
export function applyExampleLayoutReview(language){
 const directory=path.join(site,'assets/textbook-examples',language);
 for(const chapter of new Set(Object.keys(review[language]||{}).map(id=>id.split('-')[1]))){
  const file=path.join(directory,`${chapter}.json`),records=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const [id,fields]of Object.entries(review[language]||{})){
   if(!records[id])continue;
   for(const [field,change]of Object.entries(fields)){
    const hash=digest(records[id][field]);
    if(hash===change.afterSha256)continue;
    if(hash!==change.beforeSha256)throw Error(`Recheck revised example: ${language}/${id}/${field}`);
    records[id][field]=change.after;
   }
  }
  fs.writeFileSync(file,JSON.stringify(records));
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 for(const language of process.argv.slice(2).length?process.argv.slice(2):['eng','chn'])applyExampleLayoutReview(language);
}
