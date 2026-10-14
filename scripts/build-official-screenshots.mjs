// Preserve official answer text as source data; publish a separate image reading view.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { STUDY_CSS, scanHtml } from '../src/lib/study-content.js';
const context={window:{}};vm.runInNewContext(fs.readFileSync('site-data.js','utf8'),context);
const base=process.env.QA_URL || 'http://127.0.0.1:5177/';
const output='text-papers/official-screenshots';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:900,height:1000},deviceScaleFactor:2});
if(process.env.DSE_SCREENSHOT_SESSION)await page.context().addCookies([{name:'dse_session',value:process.env.DSE_SCREENSHOT_SESSION,url:base,httpOnly:true,sameSite:'Strict'}]);
await page.route(base,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
await page.goto(base);
await page.unroute(base);
let original=0,typeset=0;
try {
 for(const year of context.window.DSE_SITE_DATA.years) {
  if(process.env.DSE_SCREENSHOT_YEAR && String(year.year)!==process.env.DSE_SCREENSHOT_YEAR)continue;
  if(process.env.DSE_SCREENSHOT_LANGUAGE && year.language!==process.env.DSE_SCREENSHOT_LANGUAGE)continue;
  const file=`text-papers/${year.year}-${year.language}.json`;
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  const original2025=Number(year.year)===2025 && year.language==='chn'
   ? JSON.parse(fs.readFileSync('text-papers/2025-eng.json','utf8')) : null;
  for(const [pi,paper] of year.papers.slice(0,3).entries()) for(const q of paper.questions) {
   const key=`${year.year}|${['paper-1a','paper-1b','paper-2'][pi]}|${q.id || q.label.replace(/^Q/,'')}`;
   const record=data[key];assert.ok(record,key);
   let html=record.officialOriginal?.includes('<img ') ? record.officialOriginal : scanHtml(q.answer,year.id);
   if(original2025 && pi!==0 && (pi===1 || key.endsWith('.S'))) {
    const original=original2025[key]?.officialOriginal;
    assert.ok(original?.includes('<img '),`Missing complete 2025 marking source: ${key}`);
    // Preserve the original English source, but show the full Chinese translation.
    html='';record.officialOriginal=original;
   }
   let kind='original';
   if(!html) {
    const source=record.official;assert.ok(source,key);
    const hash=createHash('sha256').update('compact-v2:'+source).digest('hex').slice(0,24);
    const destination=`${output}/${hash}.png`;
    if(!fs.existsSync(destination)) {
     await page.setContent(`<html><head><base href="${base}"><style>${STUDY_CSS}body{margin:0;background:white}.answer{width:max-content;max-width:440px;min-width:80px;padding:12px;box-sizing:border-box}.study-content{font-size:20px;color:black}.study-content img{max-height:none}</style></head><body><div class="answer study-content">${source}</div></body></html>`);
     await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(im=>im.decode()));});
     await page.locator('.answer').screenshot({path:destination});
    }
    const width=fs.readFileSync(destination).readUInt32BE(16)/2;
    html=`<p class="study-figure"><img src="${destination}" style="width:${width}px" alt="${year.language==='eng'?'Typeset answer screenshot':'答案排版截圖'}"/></p>`;kind='typeset';typeset++;
   } else original++;
   for(const match of html.matchAll(/src="([^"]+)"/g)) assert.ok(fs.existsSync(path.resolve(match[1])),match[1]);
   record.officialScreenshot=html;record.officialScreenshotType=kind;
  }
  fs.writeFileSync(file,JSON.stringify(data));
  console.log(year.year,year.language,'ready');
 }
 console.log(JSON.stringify({original,typeset,total:original+typeset}));
}finally{await browser.close();}
