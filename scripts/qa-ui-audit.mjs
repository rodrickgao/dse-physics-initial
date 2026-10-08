import {chromium} from 'playwright';
import fs from 'node:fs';
const out='../tmp/ui-audit';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({storageState:'../tmp/exercise-qa-session.json',viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>localStorage.setItem('dse-physics-language-v1','chn'));
 const page=await context.newPage();const summary=[];
 const routes=['home','bank','papers','papers?question=2012%7Cpaper-1a%7C1','exercises','exercises?question=tb-201-1','textbook','mistakes','membership','payment','ask','focus'];
 for(const [i,route] of routes.entries()){
  await page.goto('http://127.0.0.1:5178/#'+route);await page.locator('.app-shell').waitFor();await page.waitForTimeout(450);
  await page.screenshot({path:`${out}/${i}-desktop.png`,fullPage:true});
  summary.push({route,text:(await page.locator('main').innerText()).slice(0,4500),inputs:await page.locator('input').evaluateAll(nodes=>nodes.map(n=>n.placeholder)),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 }
 await page.getByRole('button',{name:'个人设置',exact:true}).click();await page.locator('.profile-page').waitFor();await page.screenshot({path:out+'/profile-desktop.png',fullPage:true});summary.push({route:'profile',text:(await page.locator('body').innerText()).slice(0,4500)});
 await page.goto('http://127.0.0.1:5178/#home');await page.reload();await page.setViewportSize({width:390,height:844});
 for(const [i,route] of ['home','bank','exercises?question=tb-201-1','textbook','membership','ask','focus'].entries()){
  await page.goto('http://127.0.0.1:5178/#'+route);await page.locator('.app-shell').waitFor();await page.waitForTimeout(350);await page.screenshot({path:`${out}/${i}-mobile.png`,fullPage:true});
 }
 const guest=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const login=await guest.newPage();await login.goto('http://127.0.0.1:5178/');await login.locator('.auth-page').waitFor();await login.screenshot({path:out+'/login.png',fullPage:true});summary.push({route:'login',text:await login.locator('body').innerText()});
 fs.writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{await browser.close();}

