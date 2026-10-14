import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fixture,output} from './deep-test-fixture.mjs';
import {STUDY_CSS} from '../src/lib/study-content.js';
import {questions,points} from '../server/catalog.mjs';

const f=await fixture('content'),report={questions:questions.size,editions:0,blocks:0,images:0,math:0,issues:[],layouts:[],protectedPaths:[]};
const client=f.client(),user=await f.register(client,'content@local.test');f.db.prepare('INSERT INTO memberships VALUES(?,?,0,1)').run(user.id,f.clock()+30*86400000);
const blocks=[],fields=['question','answer','official','reasoning','tips','think','thinkAnswer'];
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({reducedMotion:'reduce'});await context.addCookies([{name:'dse_session',value:client.jar.get('dse_session'),url:f.base,httpOnly:true,sameSite:'Strict'}]);const page=await context.newPage();
try {
 if(process.env.DSE_DEEP_RENDER_ONLY){blocks.push(...JSON.parse(fs.readFileSync(path.join(output,'content-render-cache.json'),'utf8')));report.editions=4936;}else for(const language of ['chn','eng'])for(const [index,key]of [...questions.keys()].entries()){
  if(index%150===0)f.advance(3600001);else if(index%20===0)f.advance(61000);
  const response=await client.call('content/question?'+new URLSearchParams({id:key,language}));assert.equal(response.status,200,key+' '+JSON.stringify(response.data));const record=response.data;assert.ok(record.question,key+' missing question');assert.equal(record.kind,questions.get(key).kind);assert.ok(record.answer||record.official,key+' missing solution');
  for(const field of fields)if(record[field])blocks.push({id:key,language,field,html:record[field]});report.editions++;
  if(index%500===0)console.log('Read '+language+' '+index+' question editions');
 }
 report.blocks=blocks.length;
 fs.writeFileSync(path.join(output,'content-render-cache.json'),JSON.stringify(blocks));
 await page.goto(f.base+'__qa_blank.html');
 for(let offset=0;offset<blocks.length;offset+=100){const result=await page.evaluate(rows=>{const issues=[],images=[];let math=0;for(const row of rows){const doc=new DOMParser().parseFromString(row.html,'text/html'),add=issue=>issues.push({id:row.id,language:row.language,field:row.field,issue});for(const img of doc.images){const src=img.getAttribute('src');if(!src||/[\\"<>]/.test(src))add('invalid image URL');else images.push(src);}for(const expression of doc.querySelectorAll('math')){math++;if(expression.namespaceURI!=='http://www.w3.org/1998/Math/MathML')add('invalid MathML namespace');}for(const node of doc.querySelectorAll('mfrac,msup,msub,mroot'))if(node.children.length!==2)add('invalid '+node.tagName+' operands');for(const node of doc.querySelectorAll('msubsup'))if(node.children.length!==3)add('invalid msubsup operands');if(doc.querySelector('script,iframe,object'))add('active embedded content');}return {issues,images,math};},blocks.slice(offset,offset+100));report.issues.push(...result.issues);report.images+=result.images.length;report.math+=result.math;}
 const css=[...fs.readFileSync('dist/index.html','utf8').matchAll(/href="([^" ]+\.css)"/g)].map(match=>new URL(match[1],f.base).href);
 for(const width of [1440,834,390]){
  await page.setViewportSize({width,height:1000});await page.setContent('<!doctype html><html><head><base href="'+f.base+'">'+'<style>'+STUDY_CSS+'</style>'+css.map(url=>'<link rel="stylesheet" href="'+url+'">').join('')+'</head><body><div class="app-shell"><div class="app-main"><main class="content"><div id="qa-blocks"></div></main></div></div></body></html>');await page.evaluate(()=>document.fonts.ready);
  const failures=[];let checked=0;
  for(let offset=0;offset<blocks.length;offset+=70){f.advance(61000);
   await page.evaluate(rows=>{const root=document.querySelector('#qa-blocks');root.innerHTML=rows.map((row,i)=>'<section class="'+(row.id.startsWith('ex-')?'examples-view exercises-view':row.id.startsWith('tb-')?'exercises-view':'papers-view')+'"><article data-row="'+i+'" class="question-card"><div class="question-body"><div class="study-flow"><section class="study-stage"><div class="study-content '+(row.field==='question'||row.field==='think'?'question':row.field==='reasoning'||row.field==='tips'?'reasoning':'official')+'-content">'+row.html+'</div></section></div></div></article></section>').join('');},blocks.slice(offset,offset+70));
   const result=await page.evaluate(async()=>{await Promise.all([...document.images].map(async img=>{try{img.loading='eager';await img.decode();}catch{}}));return [...document.querySelectorAll('[data-row]')].map(article=>({index:Number(article.dataset.row),overflow:article.scrollWidth>article.clientWidth+2,broken:[...article.querySelectorAll('img')].filter(img=>!img.naturalWidth).map(img=>img.src)})).filter(row=>row.overflow||row.broken.length);});
   result.forEach(row=>failures.push({id:blocks[offset+row.index].id,language:blocks[offset+row.index].language,field:blocks[offset+row.index].field,overflow:row.overflow,broken:row.broken}));checked+=Math.min(70,blocks.length-offset);
   if(offset%1400===0)console.log('Rendered width '+width+' '+offset+' blocks');
  }
  report.layouts.push({width,checked,failures});
 }
 // Entire private packs, database files and closed chapter PDFs remain unavailable.
 for(const route of ['/text-papers/2025-chn.json','/assets/textbook-exercises/chn/101.json','/server/api.mjs','/.local-membership-preview/students.sqlite','/knowledge_catalog.json','/assets/textbook/pdfs/chn/101.pdf','/assets/textbook/pdfs/eng/101.pdf']){const response=await fetch(f.base+route.slice(1));assert.equal(response.status,404,route);report.protectedPaths.push({route,status:response.status});}
 report.passed=report.issues.length===0&&report.layouts.every(r=>r.failures.length===0);console.log(JSON.stringify({editions:report.editions,blocks:report.blocks,images:report.images,math:report.math,issues:report.issues.length,layouts:report.layouts.map(r=>({width:r.width,checked:r.checked,failures:r.failures.length})),passed:report.passed}));
}catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(output,'all-content-report.json'),JSON.stringify(report,null,2));await browser.close();await f.close();}
