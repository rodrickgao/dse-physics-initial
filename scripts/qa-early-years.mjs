import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.QA_URL || 'http://127.0.0.1:5174/';
const output = '../output/early-years-review/browser';
fs.mkdirSync(output, {recursive:true});
const browser = await chromium.launch({headless:true, channel:'chrome'});
const errors = [];
const focus = process.argv.includes('--2014-p1b');
const specs = focus ? [[2014,1,10]] : [2012,2013,2014].flatMap(y => [[y,0,y===2014?33:36],[y,1,y===2014?10:11],[y,2,36]]);
let checks = 0;
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport:{width:1440, height:1000}});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}#papers`);
    await page.locator('.question-content').waitFor();
    for (const language of ['chn', 'eng']) {
      if (language === 'eng') await page.getByRole('button', {name:'Switch language', exact:true}).click();
      for (const [year, paperIndex, count] of specs) {
        await page.setViewportSize({width:1440, height:1000});
        await page.locator('.year-grid').getByRole('button', {name:String(year), exact:true}).click();
        await page.locator('.paper-choice-list button').nth(paperIndex).click();
        await page.setViewportSize({width, height:width === 390 ? 844 : 1000});
        const ids = paperIndex===2 ? [1,2,3,4].flatMap(s => [1,2,3,4,5,6,7,8,'S'].map(q => `${s}.${q}`)) : Array.from({length:count},(_,i) => String(i+1));
        for (let n=1; n<=count; n++) {
          const key = `${year}|${['paper-1a','paper-1b','paper-2'][paperIndex]}|${ids[n-1]}`;
          const flow = page.locator(`.study-flow[data-question="${key}"]`);
          await flow.locator('.question-content').waitFor();
          assert.equal(await flow.locator('#official-stage').count(), 0, `${key}: stage reset`);
          await flow.locator('button[aria-controls="official-stage"]').click();
          await flow.locator('button[aria-controls="reasoning-stage"]').click();
          await flow.locator('.reasoning-content').waitFor();
          assert.equal(await flow.locator('.official-content').evaluate(e=>getComputedStyle(e).color),'rgb(255, 0, 0)');
          assert.equal(await flow.locator('.reasoning-content').evaluate(e=>getComputedStyle(e).color),'rgb(0, 0, 255)');
          assert.ok((await flow.locator('.reasoning-content').innerText()).length > 25, key);
          await flow.locator('.study-content img').evaluateAll(async imgs => {
            await Promise.all(imgs.map(img => img.decode()));
          });
          assert.ok(await flow.locator('.study-content img').evaluateAll(imgs => imgs.every(img => img.naturalWidth > 0)), key);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), `${key}: viewport overflow`);
          const overflowing = await flow.locator('.study-content').evaluateAll(nodes => nodes.filter(el => el.scrollWidth > el.clientWidth+2).length);
          assert.equal(overflowing, 0, `${key}: content overflow at ${width}`);
          if ((paperIndex===2 && ids[n-1].endsWith('.S')) || (year===2014 && paperIndex===1 && [3,4,6,9,10].includes(n)) || (paperIndex===0 && n===17)) {
            await page.locator('.question-header').scrollIntoViewIfNeeded();
            await page.locator('.question-card').screenshot({path:`${output}/${year}-${language}-${['p1a','p1b','p2'][paperIndex]}-q${ids[n-1]}-${width}.png`});
          }
          checks++;
          if (n < count) await page.getByRole('button', {name:'Next', exact:true}).click();
        }
        console.log(`PASS ${width}px ${language} ${year} paper ${paperIndex+1}: ${count} questions`);
      }
    }
    assert.equal(await page.locator('.archived-years').count(),0);
    await page.close();
  }
  assert.deepEqual(errors, []);
  assert.equal(checks,focus ? 40 : 980);
  const report = {editions:checks/2, viewports:[1440,390], renderedQuestionChecks:checks, consoleErrors:errors, yearIntegration:'passed', answerColours:'passed'};
  fs.writeFileSync(`${output}/${focus ? 'report-2014-p1b' : 'report'}.json`, JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {
  await browser.close();
}
