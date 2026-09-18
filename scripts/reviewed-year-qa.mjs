import {chromium} from 'playwright';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {printDocumentHtml} from '../src/lib/study-content.js';
const yr=Number(process.argv[2]||2012),part=Number(process.argv[3]||0);
const output=`../tmp/reviewed-year-qa/${yr}-${part}`;fs.mkdirSync(output,{recursive:true});
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('site-data.js','utf8'),ctx);
const browser=await chromium.launch({headless:true,channel:'chrome'});
for(const language of ['eng','chn']){
 const year=ctx.window.DSE_SITE_DATA.years.find(x=>Number(x.year)===yr&&x.language===language);
 const data=JSON.parse(fs.readFileSync(`text-papers/${yr}-${language}.json`));
 const entries=year.papers[part].questions.map((q,i)=>({year,paperIndex:part,question:q,key:`${yr}|${['paper-1a','paper-1b','paper-2'][part]}|${q.id||Number(q.label.replace(/\D/g,''))||i+1}`}));
 const contents=entries.map(e=>data[e.key]);
 assert.ok(contents.every(x=>x?.question&&x?.reasoning));
 const page=await browser.newPage({viewport:{width:820,height:1100}});
 await page.setContent(printDocumentHtml(entries,contents,{language,mode:'detailed',baseUrl:'http://127.0.0.1:5173/'}),{waitUntil:'networkidle'});
 await page.evaluate(()=>document.fonts.ready);
 assert.ok(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)));
 await page.pdf({path:`${output}/${language}.pdf`,preferCSSPageSize:true,printBackground:true});
 for(const width of [820,390]){
  await page.setViewportSize({width,height:1100});
  const overflow=await page.locator('.study-content').evaluateAll(nodes=>nodes.filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.closest('article').dataset.question));
  assert.deepEqual(overflow,[],`${language} ${width} overflow`);
 }
 await page.close();
}
await browser.close();console.log('PASS: every reviewed question rendered; all assets and desktop/mobile content widths checked.');
