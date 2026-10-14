import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='http://127.0.0.1:5182',out='../tmp/ui-improvements';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const failures=[];
async function account(email){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const otp=await(await context.request.post(base+'/api/auth/code',{data:{email}})).json();
 const login=await(await context.request.post(base+'/api/auth/verify',{data:{email,code:otp.developmentCode}})).json();assert.ok(login.user);
 if(!login.user.profileComplete)assert.ok((await context.request.put(base+'/api/profile',{data:{nickname:'界面检查',grade:'中五',target:'5',avatar:'newton-wave',password:'Study-pass-123',confirmPassword:'Study-pass-123'}})).ok());
 await context.addInitScript(()=>{localStorage.setItem('dse-physics-language-v1','chn');window.print=()=>{};});
 return {context,user:login.user};
}
const check=async(name,fn)=>{try{await fn();console.log('PASS '+name);}catch(e){failures.push({name,error:e.stack});console.log('FAIL '+name+': '+e.message);}};
try{
 const {context,user}=await account('rodrick_gao@163.com');
 const adminKey=fs.readFileSync('.local-exercise-qa/admin-key.txt','utf8').trim();
 assert.ok((await context.request.post(base+'/api/admin/login',{data:{key:adminKey}})).ok());
 async function membership(action){const current=await(await context.request.get(base+'/api/membership')).json();const response=await context.request.post(base+'/api/admin/membership',{data:{userId:user.id,action,days:30,reason:'Isolated local UI verification',revision:current.membership.revision,requestId:crypto.randomUUID()}});assert.ok(response.ok(),await response.text());}
 if(!(await(await context.request.get(base+'/api/membership')).json()).membership.active)await membership('extend');
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const go=async(route)=>{await page.goto(base+'/#'+route);await page.locator('.app-shell').waitFor();};
 const ready=()=>page.locator('[data-exercise][aria-busy="false"]').waitFor();
 const shot=async(name)=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');await page.screenshot({path:`${out}/${name}.png`,fullPage:true});};
 const records=JSON.parse(fs.readFileSync('assets/textbook-exercises/chn/102.json','utf8'));
 let explained;const index=JSON.parse(fs.readFileSync('assets/textbook-exercises/index-chn.json','utf8'));
 for(const chapter of index.books.flatMap(b=>b.chapters)){const data=JSON.parse(fs.readFileSync(`assets/textbook-exercises/chn/${chapter.id}.json`,'utf8'));explained=Object.values(data).find(r=>r.reasoning);if(explained)break;}
 await check('unified full-text search, source filters and direct opening',async()=>{
  await go('bank');await page.locator('.bank-source-filter').getByRole('button',{name:'课本习题',exact:true}).click();assert.equal(await page.locator('.question-bank-option').count(),1);
  await page.locator('#bank-search').fill('温度');await page.locator('.bank-search-result').first().waitFor({timeout:60000});
  assert.ok((await page.locator('.bank-search-result strong').allTextContents()).every(s=>s.includes('课本习题')));
  await page.locator('.bank-source-filter').getByRole('button',{name:'真题',exact:true}).click();assert.ok((await page.locator('.bank-search-result strong').allTextContents()).every(s=>!s.includes('课本习题')));
  await page.locator('.bank-source-filter').getByRole('button',{name:'课本习题',exact:true}).click();await page.locator('.bank-search-result').first().click();await ready();assert.match(page.url(),/exercises\?question=tb-/);
 });
 await check('book directory, question history and reload',async()=>{
  await go('exercises');await page.locator('.book-card').nth(1).click();assert.match(page.url(),/book=compulsory-2/);await page.reload();await page.locator('.exercise-directory').waitFor();
  await page.locator('.exercise-directory>button').first().click();await ready();assert.match(page.url(),/tb-201-1/);
  await page.getByRole('button',{name:'下一题',exact:true}).click();await page.locator('[data-exercise="tb-201-2"][aria-busy="false"]').waitFor();
  await page.waitForFunction(()=>{const n=document.getElementById('current-question');return n&&n.getBoundingClientRect().top>=0&&n.getBoundingClientRect().bottom<innerHeight;});
  await page.goBack();await page.locator('[data-exercise="tb-201-1"][aria-busy="false"]').waitFor();
  await page.goBack();await page.locator('.exercise-directory').waitFor();
 });
 await check('bulk mastery and reset update status without a feedback label',async()=>{
  const keys=index.questions.filter(q=>q.chapter==='201').map(q=>q.id);
  await context.request.put(base+'/api/progress',{data:{keys,status:'clear'}});
  await context.request.put(base+'/api/mistakes',{data:{key:keys[0],marked:true}});
  await go('exercises?question=tb-201-1');await ready();await page.getByRole('button',{name:'标记本章已掌握',exact:true}).click();await page.getByRole('button',{name:'本章已掌握 ✓',exact:true}).waitFor();
  assert.equal(await page.locator('#exercise-navigator .mastered').count(),keys.length);
  assert.equal(await page.locator('.study-feedback').count(),0);
  await page.getByRole('button',{name:'本章已掌握 ✓',exact:true}).click();await page.getByRole('button',{name:'标记本章已掌握',exact:true}).waitFor();
  const after=await(await context.request.get(base+'/api/mistakes')).json();assert.ok(keys.every(key=>!after.mastered[key]));
  assert.equal(await page.locator('.study-feedback').count(),0);
  await page.reload();await ready();assert.equal(await page.locator('#exercise-navigator .mastered').count(),0);
 });
 await check('exercise and past-paper ask context',async()=>{
  await go('exercises?question=tb-201-1');await ready();await page.getByRole('button',{name:'问这道题',exact:true}).click();await page.locator('.ask-context').waitFor();assert.match(await page.locator('.ask-context').innerText(),/201.*Q1/);assert.equal(await page.locator('.tutoring-form select').count(),0);
  await go('papers?question=2012%7Cpaper-1a%7C1');await page.locator('[data-study-question="2012|paper-1a|1"]').waitFor();await page.getByRole('button',{name:'问这道题',exact:true}).click();await page.locator('.ask-context').waitFor();assert.match(await page.locator('.ask-context').innerText(),/2012/);
 });
 await check('member explanations, links and revoked cache',async()=>{
  await go('exercises?question='+explained.id);await ready();await page.getByRole('button',{name:'查看标答',exact:true}).click();await page.getByRole('button',{name:'查看详解',exact:true}).click();await page.locator('.reasoning-content').waitFor();assert.ok(await page.locator('.exercise-knowledge button').count());
  await membership('revoke');await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.locator('.exercise-knowledge .member-notice').waitFor();await ready();assert.equal(await page.locator('.reasoning-content').count(),0);
  await page.getByRole('button',{name:'查看标答',exact:true}).click();assert.ok(await page.getByRole('button',{name:'查看详解',exact:true}).isDisabled());assert.ok(await page.locator('.official-content').innerText());
  assert.ok(!JSON.stringify(await(await context.request.get(base+`/assets/textbook-exercises/chn/${explained.chapter}.json`)).json()).includes('"reasoning":'));
  await membership('extend');await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.locator('.exercise-knowledge button').first().waitFor();
 });
 await check('home review includes exercises, resume and embedded profile',async()=>{
  await go('exercises?question=tb-201-1');await ready();await page.locator('.nav-list').getByRole('button',{name:'主页',exact:true}).click();await page.locator('.continue-study').getByRole('button',{name:'继续学习',exact:true}).waitFor();assert.match(await page.locator('.continue-study').innerText(),/201.*Q1/);assert.match(await page.locator('.home-review').innerText(),/课本习题/);
  await shot('home-desktop');await page.getByRole('button',{name:'个人设置',exact:true}).click();await page.locator('.profile-embedded').waitFor();assert.ok(await page.locator('.sidebar').isVisible());assert.equal(await page.locator('.profile-review').count(),0);await shot('profile-desktop');
  await page.locator('.profile-header').getByRole('button',{name:'返回',exact:true}).click();await page.locator('.home-view').waitFor();
 });
 await check('knowledge chapter directory persists',async()=>{
  await go('textbook');await page.locator('.book-card').nth(1).click();await page.locator('.chapter-list button').nth(2).click();const hash=new URL(page.url()).hash;assert.match(hash,/book=1&chapter=/);await page.reload();await page.locator('.chapter-list button[aria-pressed="true"]').waitFor();assert.equal(new URL(page.url()).hash,hash);
 });
 await check('desktop, mobile, English and dark layout',async()=>{
  for(const route of ['bank','papers?question=2012%7Cpaper-1a%7C1','exercises?question=tb-202-1','membership']){await go(route);await page.waitForTimeout(400);await shot(route.split('?')[0]+'-desktop');}
  await page.setViewportSize({width:390,height:844});await go('home');await shot('home-mobile');assert.equal(await page.locator('.compact-mobile-nav>button').count(),5);assert.equal(await page.locator('.teacher-float').count(),0);
  await page.locator('.compact-mobile-nav').getByRole('button',{name:'更多',exact:true}).click();await page.locator('.mobile-more-menu').getByRole('button',{name:'问老师',exact:true}).click();await page.locator('.tutoring-view').waitFor();assert.equal(await page.locator('.mobile-more-menu').count(),0);
  await go('exercises?question=tb-202-1');await ready();await shot('exercise-mobile');await page.locator('.mobile-picker').click();await page.locator('#exercise-navigator button').nth(1).click();await ready();await shot('exercise-mobile-next');
  await page.evaluate(()=>{localStorage.setItem('dse-physics-language-v1','eng');document.documentElement.classList.add('dark');localStorage.setItem('dse-physics-theme-v1','dark');});
  // The init script establishes Chinese on reload; change the language through the visible switch.
  await page.locator('.language-switch').click();await page.getByRole('button',{name:'Show model answer',exact:true}).waitFor();await shot('exercise-mobile-english-dark');
 });
 const free=await account('free@local.test');const freePage=await free.context.newPage();
 await check('ordinary account model answers and teacher restriction',async()=>{
  await freePage.goto(base+'/#exercises?question='+explained.id);await freePage.locator('[data-exercise][aria-busy="false"]').waitFor();await freePage.getByRole('button',{name:'查看标答',exact:true}).click();assert.ok(await freePage.locator('.official-content').innerText());assert.ok(await freePage.getByRole('button',{name:'查看详解',exact:true}).isDisabled());assert.equal(await freePage.locator('.exercise-knowledge button').count(),0);
  await freePage.getByRole('button',{name:'问这道题',exact:true}).click();await freePage.getByRole('link',{name:'查看会员权益',exact:true}).waitFor();assert.equal(await freePage.locator('textarea').count(),0);
  await freePage.goto(base+'/#receipt');await freePage.getByRole('button',{name:'提交审核',exact:true}).waitFor();assert.ok(await freePage.getByRole('button',{name:'提交审核',exact:true}).isDisabled());
 });
 await check('payment review message reflects actual approval without a fake countdown',async()=>{
  let approved=false;
  await freePage.route('**/api/orders',route=>route.fulfill({json:{order:{status:approved?'approved':'pending'}}}));
  await freePage.route('**/api/membership',route=>route.fulfill({json:{membership:{active:approved,endsAt:Date.now()+86400000,revision:1}}}));
  await freePage.route('**/api/premium/network',route=>route.fulfill({json:{network:{}}}));
  await freePage.goto(base+'/#activating');await freePage.getByRole('heading',{name:'已提交，等待审核',exact:true}).waitFor();
  await freePage.waitForTimeout(5500);assert.ok(await freePage.getByRole('heading',{name:'已提交，等待审核',exact:true}).isVisible());assert.equal(await freePage.locator('.member-success-content').count(),0);
  approved=true;await freePage.locator('.member-success-content').waitFor({timeout:10000});
 });
 const guest=await browser.newPage({viewport:{width:1440,height:1000}});await guest.goto(base);await guest.locator('.auth-page').waitFor();await guest.screenshot({path:out+'/login.png',fullPage:true});
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/results.json',JSON.stringify(failures,null,2));assert.deepEqual(failures,[]);
}finally{await browser.close();}
