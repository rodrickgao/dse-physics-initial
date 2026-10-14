import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/rodri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { fixture } from './deep-test-fixture.mjs';
import { questions } from '../server/catalog.mjs';
import { printDocumentHtml, preparePrintedAnswerSpaces } from '../src/lib/study-content.js';

const out = path.resolve('../output/print-subquestions-20261013');
const pdfOut = path.resolve('../output/pdf/print-subquestions-20261013');
fs.mkdirSync(out, {recursive:true}); fs.mkdirSync(pdfOut, {recursive:true});
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const f = await fixture('print-subquestions');
const client = f.client(), user = await f.register(client, 'print-subquestions@local.test');
f.db.prepare('INSERT INTO memberships VALUES(?,?,0,1)').run(user.id, f.clock()+30*86400000);
const browser = await chromium.launch({channel:'chrome',headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
for (const [name,value] of client.jar) await context.addCookies([{name,value,url:f.base,httpOnly:true,sameSite:'Strict'}]);
await context.addInitScript(id => {
  try {localStorage.setItem('ddphysics-tour:v4:'+encodeURIComponent(id), JSON.stringify({version:4,status:'skipped'}));} catch {}
  window.print = () => {window.printCalled=true;};
}, user.id);
const report = {pdfs:[],flows:[],errors:[]};
context.on('page', p => p.on('pageerror', e => report.errors.push(e.message)));
const contentFor = (key,language) => {
  const q = questions.get(key);
  return read(q.source ? `assets/textbook-${q.source==='examples'?'examples':'exercises'}/${language}/${q.exerciseChapter}.json` : `text-papers/${key.split('|')[0]}-${language}.json`)[key];
};
const entryFor = key => {
  const q = questions.get(key), [year,paper] = key.split('|');
  return {key,source:q.source,exerciseChapter:q.exerciseChapter,year:{year:Number(year),id:year+'-chn'},paperIndex:q.source?1:['paper-1a','paper-1b','paper-2'].indexOf(paper),question:{label:q.label,kind:q.kind}};
};
const ready = page => page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
const fingerprint = page => page.locator('.question-content').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,images:[...n.querySelectorAll('img')].map(i=>({src:i.getAttribute('src'),alt:i.getAttribute('alt')})),math:[...n.querySelectorAll('math')].map(i=>i.outerHTML),cells:[...n.querySelectorAll('td')].map(i=>i.innerHTML)})));
try {
  for (const language of ['chn','eng']) {
    const candidates = [...questions.keys()].filter(k=>questions.get(k).kind!=='multiple-choice');
    const longest = candidates.map(key=>({key,length:contentFor(key,language)?.question?.length||0})).sort((a,b)=>b.length-a.length).slice(0,3).map(r=>r.key);
    const samples = [...new Set([...Array.from({length:6},(_,i)=>`2012|paper-1a|${i+1}`),'2025|paper-1b|8','2019|paper-1b|9','2013|paper-1b|10','2015|paper-1b|7','2016|paper-1b|5','2017|paper-1b|4','2017|paper-1b|6','2017|paper-1b|8','2017|paper-1b|9',...longest])];
    for (const [group,keys] of [['screenshot',['tb-E303-22']],['long',samples]]) for (const mode of ['questions','detailed']) {
      f.advance(61000);
      const page = await context.newPage(); await page.goto(f.base+'__qa_blank.html');
      const entries=keys.map(entryFor), contents=keys.map(k=>contentFor(k,language));
      if(group==='long') {
        entries.push({key:'synthetic-nested',year:{year:2026,id:'2026'},paperIndex:1,question:{label:'Nested pagination regression',kind:'structured'}});
        contents.push({question:'<p>(a) Shared context for three subquestions.</p>'+['i','ii','iii'].map((label,i)=>`<p>${i===1?'(a)(ii)':`(${label})`} Complete prompt ${i+1}.</p><div class="study-table-wrap"><table><tbody><tr style="height:85mm"><td>Table belonging to prompt ${i+1}</td></tr></tbody></table></div>`).join('')+'<p>(b) Next question.</p>',official:'<p>B</p>',reasoning:'<p>Test fixture only.</p>'});
      }
      await page.setContent(printDocumentHtml(entries,contents,{language,mode,baseUrl:f.base,date:new Date(2026,9,13)}));
      await ready(page); await page.emulateMedia({media:'print'});
      const before = await fingerprint(page);
      await page.evaluate(`(${preparePrintedAnswerSpaces.toString()})(document)`);
      const printStyles=await page.evaluate(()=>{
        const choice=document.querySelector('.print-choice'),body=document.querySelector('.print-structured .study-content'),img=document.querySelector('.print-structured .study-content img');
        return {choicePaddingMm:choice?parseFloat(getComputedStyle(choice).paddingLeft)/96*25.4:null,fontPt:parseFloat(getComputedStyle(body).fontSize)*.75,lineHeight:parseFloat(getComputedStyle(body).lineHeight)/parseFloat(getComputedStyle(body).fontSize),imageZoom:img?Number(getComputedStyle(img).zoom):null};
      });
      assert.ok(Math.abs(printStyles.fontPt-11)<.01);
      assert.ok(Math.abs(printStyles.lineHeight-1.5)<.01);
      if(printStyles.imageZoom!==null)assert.equal(printStyles.imageZoom,.94);
      if(group==='long')assert.ok(Math.abs(printStyles.choicePaddingMm-0)<.02);
      assert.deepEqual(await fingerprint(page),before,'grouping must preserve all content');
      const html = await page.locator('.print-document').innerHTML();
      await page.evaluate(`(${preparePrintedAnswerSpaces.toString()})(document)`);
      assert.equal(await page.locator('.print-document').innerHTML(),html,'repeated printing must be stable');
      if(group==='screenshot') {
        assert.equal(await page.locator('[data-print-part="a"] .study-table-wrap tr').count(),6);
        assert.equal(await page.locator('[data-print-part="a"].oversized-print-part').count(),0);
      } else {
        const nested=page.locator('[data-question="synthetic-nested"]');
        assert.equal(await nested.locator('.print-part.oversized-print-part').count(),1);
        assert.deepEqual(await nested.locator('[data-print-part="a"]>.print-subpart').evaluateAll(nodes=>nodes.map(n=>n.dataset.printSubpart)),['','i','ii','iii']);
        assert.equal(await nested.locator('.print-subpart.oversized-print-part').count(),0);
      }
      const metrics = await page.locator('.print-part,.print-subpart,.question-content .study-table-wrap').evaluateAll(nodes=>nodes.map((n,i)=>{
        const height=n.getBoundingClientRect().height,protect=!n.classList.contains('oversized-print-part')&&height<(297-38-18)/25.4*96-2;
        if(protect) {
          n.style.position='relative';
          for(const [kind,position] of [['START','top:0;left:0'],['END','bottom:0;right:0']]) {
            const marker=document.createElement('span'); marker.textContent=`PART${i}${kind}MARK`;
            marker.style.cssText=`position:absolute;${position};font:1px/1 Arial;color:rgba(0,0,0,.01)`;n.append(marker);
          }
        }
        return {id:i,key:n.closest('.print-question').dataset.question,part:n.dataset.printPart,subpart:n.dataset.printSubpart,height,protect};
      }));
      assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.question-content')].every(n=>n.scrollWidth<=n.clientWidth+1)));
      const file=path.join(pdfOut,`${language}-${group}-${mode}.pdf`);
      await page.pdf({path:file,preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
      report.pdfs.push({language,group,mode,path:file,metrics,printStyles}); await page.close();
      console.log('PASS '+language+' '+group+' '+mode);
    }
    // Use the site's actual print window as well as direct layout samples.
    f.advance(61000); await client.call('mistakes/import',{keys:['2012|paper-1a|1','tb-E303-22','2025|paper-1b|8']});
    const page=await context.newPage();await page.goto(f.base+'__qa_blank.html');
    await page.evaluate(l=>localStorage.setItem('dse-physics-language-v1',l),language);
    await page.goto(f.base+'#mistakes');await page.locator('[data-mistake]').first().waitFor();
    for(const mode of ['questions','detailed']) {
      f.advance(61000);
      const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator('.export-controls').getByRole('button',{name:language==='eng'?(mode==='questions'?'Questions':'Solutions'):(mode==='questions'?'原题版':'详解版'),exact:true}).click()]);
      await popup.waitForFunction(()=>window.printCalled);await ready(popup);
      const padding=await popup.locator('.print-choice').evaluate(n=>parseFloat(getComputedStyle(n).paddingLeft)/96*25.4);
      assert.ok(Math.abs(padding-0)<.02);
      assert.equal(await popup.locator('[data-print-part="a"] .study-table-wrap tr').count(),6);
      await popup.evaluate(()=>dispatchEvent(new Event('beforeprint')));
      assert.equal(await popup.locator('[data-print-part="a"] .study-table-wrap tr').count(),6);
      report.flows.push({language,mode,actualPopup:true,passed:true});await popup.close();
    }
    await page.close();
  }
  assert.deepEqual(report.errors,[]);
} catch(error) {report.failure=error.stack;throw error;}
finally {
  fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));
  await browser.close();await f.close();
  // Remove only this fixture's verified temporary directory.
  if(!path.basename(f.directory).startsWith('ddphysics-deep-print-subquestions-'))throw Error('Unexpected fixture path');
  fs.rmSync(f.directory,{recursive:true});
}
