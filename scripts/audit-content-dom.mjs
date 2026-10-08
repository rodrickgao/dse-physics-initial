import fs from 'node:fs';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const ledger=JSON.parse(fs.readFileSync('../output/full-audit-20261009/content-ledger.json','utf8'));
const cache=new Map(), rows=ledger.map(r=>{
 if(!cache.has(r.file))cache.set(r.file,JSON.parse(fs.readFileSync(r.file,'utf8')));
 return {...r,record:cache.get(r.file)[r.id]};
});
const browser=await chromium.launch({channel:'chrome',headless:true});
const issues=[];let mathCount=0,imageCount=0;
try{
 const page=await browser.newPage();
 for(let offset=0;offset<rows.length;offset+=100){
  const result=await page.evaluate(rows=>{
   const issues=[];let mathCount=0,imageCount=0;
   for(const row of rows)for(const field of ['question','answer','official','reasoning','tips','think','thinkAnswer']){
    const html=row.record[field];if(!html)continue;
    const doc=new DOMParser().parseFromString(html,'text/html');
    const add=issue=>issues.push({id:row.id,language:row.language,field,issue});
    for(const img of doc.images){imageCount++;if(!img.getAttribute('src')||/[\\"<>]/.test(img.getAttribute('src')))add('invalid image URL');}
    for(const math of doc.querySelectorAll('math')){mathCount++;if(math.namespaceURI!=='http://www.w3.org/1998/Math/MathML')add('invalid math namespace');}
    for(const node of doc.querySelectorAll('mfrac,msup,msub,mroot'))if(node.children.length!==2)add('invalid '+node.tagName+' operands');
    for(const node of doc.querySelectorAll('msubsup'))if(node.children.length!==3)add('invalid msubsup operands');
    if(doc.querySelector('script,iframe'))add('active embedded content');
   }
   return {issues,mathCount,imageCount};
  },rows.slice(offset,offset+100));
  issues.push(...result.issues);mathCount+=result.mathCount;imageCount+=result.imageCount;
 }
 const result={editions:rows.length,mathCount,imageCount,issues};
 fs.writeFileSync('../output/full-audit-20261009/dom-check.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,issues:issues.slice(0,20)}));
}finally{await browser.close();}
