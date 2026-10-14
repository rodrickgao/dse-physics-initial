import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { questions } from '../server/catalog.mjs';
import { printDocumentHtml, preparePrintedAnswerSpaces } from '../src/lib/study-content.js';

// Use exact natural image dimensions without fetching protected assets in bulk.
// Actual diagrams are visually checked in qa-print-subquestions.mjs.
const packs=new Map(),images=new Map(),read=file=>{
  if(!packs.has(file))packs.set(file,JSON.parse(fs.readFileSync(file,'utf8')));
  return packs.get(file);
};
async function dimensionImage(src) {
  if(!images.has(src))images.set(src,(async()=>{
    const file=path.resolve(src);if(!file.startsWith(path.resolve('.')+path.sep))throw Error('Invalid source image path');
    const {width,height}=await sharp(file).metadata();
    return 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"/>`);
  })());
  return images.get(src);
}
async function dimensionQuestion(html) {
  const srcs=[...new Set([...html.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(m=>m[1]))];
  const replacements=new Map(await Promise.all(srcs.map(async src=>[src,await dimensionImage(src)])));
  return html.replace(/(<img\b[^>]*src=")([^"]+)(")/g,(_,start,src,end)=>start+replacements.get(src)+end+` data-print-asset="${src}"`);
}
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();await page.emulateMedia({media:'print'});
const report={questions:0,parts:0,oversizedPrompts:[],oversizedIntroductions:[]};
try {
  for(const language of ['chn','eng']) {
    const all=[...questions.values()].filter(q=>q.kind!=='multiple-choice');
    for(let start=0;start<all.length;start+=80) {
      const batch=all.slice(start,start+80);
      const entries=batch.map(q=>{
        const [year,paper]=q.key.split('|');
        return {key:q.key,source:q.source,exerciseChapter:q.exerciseChapter,year:{year:Number(year),id:year+'-'+language},paperIndex:q.source?1:['paper-1a','paper-1b','paper-2'].indexOf(paper),question:{label:q.label,kind:q.kind}};
      });
      const contents=await Promise.all(batch.map(async q=>{
        const file=q.source?`assets/textbook-${q.source==='examples'?'examples':'exercises'}/${language}/${q.exerciseChapter}.json`:`text-papers/${q.key.split('|')[0]}-${language}.json`;
        return {question:await dimensionQuestion(read(file)[q.key].question)};
      }));
      await page.setContent(printDocumentHtml(entries,contents,{language,mode:'questions',baseUrl:'http://127.0.0.1:5178/'}));
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
      await page.evaluate(`(${preparePrintedAnswerSpaces.toString()})(document)`);
      const sizes=await page.locator('.print-subpart').evaluateAll(nodes=>nodes.map(n=>({key:n.closest('.print-question').dataset.question,part:n.parentElement.dataset.printPart,subpart:n.dataset.printSubpart,heightMm:n.getBoundingClientRect().height/96*25.4,oversized:n.classList.contains('oversized-print-part')})));
      report.questions+=batch.length;report.parts+=sizes.length;
      for(const row of sizes.filter(n=>n.oversized))report[row.part==='introduction'?'oversizedIntroductions':'oversizedPrompts'].push({language,...row});
      console.log(language,start+batch.length+'/'+all.length);
    }
  }
} finally {
  fs.writeFileSync('../output/print-subquestions-20261013/all-part-sizes.json',JSON.stringify(report,null,2));
  await browser.close();
}
console.log(JSON.stringify({questions:report.questions,parts:report.parts,oversizedPrompts:report.oversizedPrompts.length,oversizedIntroductions:report.oversizedIntroductions.length}));
