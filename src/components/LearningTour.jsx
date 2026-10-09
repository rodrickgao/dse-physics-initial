import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Button} from './ui/button';
import {coreSteps,pageSteps,pageTours} from '../lib/tour-steps';
import {completeTourStep,readTour,saveTour} from '../lib/tour-state';
import './learning-tour.css';

const storage=()=>{try{return window.localStorage;}catch{return null;}};
const visible=node=>!!node&&node.getClientRects().length>0&&!node.closest('[hidden]');
const find=target=>(Array.isArray(target)?target:[target]).map(id=>[...document.querySelectorAll(`[data-tour="${id}"]`)].find(visible)).find(Boolean);
const focusables=root=>root?[...(root.matches?.('button,summary,a,input,select,textarea,[tabindex="0"]')?[root]:[]),...root.querySelectorAll('button,summary,a[href],input,select,textarea,[tabindex="0"]')].filter(n=>visible(n)&&!n.disabled):[];
export function LearningTour({userId,page,language,navigate}){
 const en=language==='eng',say=(zh,eng)=>en?eng:zh;
 const [progress,setProgress]=useState(()=>readTour(storage(),userId));
 const progressRef=useRef(progress);progressRef.current=progress;
 const [view,setView]=useState(()=>['not-started','in-progress'].includes(readTour(storage(),userId).status)?{kind:'welcome'}:null);
 const [offer,setOffer]=useState(null),[layout,setLayout]=useState(null),[missing,setMissing]=useState(false),[saved,setSaved]=useState(true);
 const lastLayout=useRef(null);
 const [settledStep,setSettledStep]=useState('');
 const panel=useRef(null),origin=useRef(null),target=useRef(null),run=useRef(null),advanced=useRef('');
 const steps=view?.tour==='core'?coreSteps:pageSteps(view?.tour||page);
 const current=view?.kind==='run'?steps[view.index]:null;
 const reviewing=(view?.completed||[]).includes(view?.index)||(view?.tour==='core'&&view.index<=progress.lastCompleted&&!progress.skippedSteps.includes(view.index));
 const commit=value=>{progressRef.current=value;setProgress(value);setSaved(saveTour(storage(),userId,value));};
 const restoreFocus=()=>requestAnimationFrame(()=>{const node=origin.current?.isConnected&&visible(origin.current)?origin.current:find(['tour-help','profile-settings','page-root']);node?.focus({preventScroll:true});});
 function close(){
  if(view?.kind==='welcome'||view?.kind==='run'&&view.tour==='core')commit({...progressRef.current,status:'skipped'});
  if(view?.kind==='run'&&view.tour!=='core')commit({...progressRef.current,pages:{...progressRef.current.pages,[view.tour]:'skipped'}});
  setView(null);setLayout(null);target.current=null;restoreFocus();
 }
 function prepare(step){if(step?.route)navigate(...step.route);}
 function start(tour,resume=false){
  origin.current=document.activeElement;setOffer(null);
  const index=tour==='core'&&resume?Math.min(coreSteps.length-1,progressRef.current.lastCompleted+1):0;
  if(tour==='core')commit({...progressRef.current,status:'in-progress',lastCompleted:resume?progressRef.current.lastCompleted:-1,skippedSteps:resume?progressRef.current.skippedSteps:[]});
  else {if(tour!==page)navigate(tour);commit({...progressRef.current,pages:{...progressRef.current.pages,[tour]:'in-progress'}});}
  prepare((tour==='core'?coreSteps:pageSteps(tour))[index]);setView({kind:'run',tour,index,completed:[]});
 }
 function advance(){
  if(!view||view.kind!=='run')return;
  if(view.tour==='core')commit(completeTourStep(progressRef.current,view.index));
  if(view.index===steps.length-1){
   if(view.tour!=='core')commit({...progressRef.current,pages:{...progressRef.current.pages,[view.tour]:'completed'}});
   else commit({...progressRef.current,pages:{...progressRef.current.pages,examples:'completed'}});
   setView({kind:'done'});target.current=null;setLayout(null);
  }else {prepare(steps[view.index+1]);setView({...view,index:view.index+1,completed:[...new Set([...(view.completed||[]),view.index])]});}
 }
 function skipStep(){
  // Missing action targets must not be recorded as successfully completed.
  if(view.index===steps.length-1){close();return;}
  if(view.tour==='core')commit({...progressRef.current,skippedSteps:[...new Set([...progressRef.current.skippedSteps,view.index])]});
  const next={...view,index:view.index+1};prepare(steps[next.index]);setView(next);
 }
 run.current={view,current,reviewing,advance,close};
 // First visits offer a dismissible, non-modal invitation. Offering is persisted
 // too: ignoring it never causes a popup every time the user revisits a page.
 useEffect(()=>{if(view)document.documentElement.dataset.tourActive='true';else delete document.documentElement.dataset.tourActive;return()=>{delete document.documentElement.dataset.tourActive;};},[!!view]);
 useLayoutEffect(()=>{
  if(!current){lastLayout.current=null;setLayout(null);setMissing(false);target.current=null;return;}
  let first=true,lastTarget=null,scrollAt=0,completionTimer=null,lastBox='',stableSince=Date.now();
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const since=Date.now(),identity=`${view.tour}:${view.index}`;advanced.current='';setMissing(false);setSettledStep('');
  const update=()=>{
   const live=run.current;
   if(live.view?.kind!=='run')return;
   if(current.mode==='action'&&!live.reviewing&&current.complete&&document.querySelector(current.complete)&&advanced.current!==identity){
    advanced.current=identity;completionTimer=setTimeout(()=>{if(run.current.current===current)run.current.advance();},reducedMotion?0:160);return;
   }
   const node=find(current.target);target.current=node||null;
   if(!node){stableSince=Date.now();lastBox='';setSettledStep('');setLayout(null);setMissing(Date.now()-since>4500);return;}
   setMissing(Boolean(node.disabled||node.getAttribute('aria-disabled')==='true'||current.unavailable&&document.querySelector(current.unavailable))&&Date.now()-since>4500);
   const bounds=node.getBoundingClientRect(),changed=node!==lastTarget;
   // Async knowledge cards can move an existing target after it was first found.
   // Keep small action targets clear of sticky navigation without repeatedly centring large panels.
   const outside=bounds.top<100||bounds.bottom>innerHeight-120;
   if(changed||(Date.now()-scrollAt>750&&current.mode==='action'&&bounds.height<innerHeight-240&&outside)){
    lastTarget=node;scrollAt=Date.now();
    if(outside)node.scrollIntoView({block:'center',inline:'nearest',behavior:reducedMotion?'instant':'smooth'});
   }
   const box=node.getBoundingClientRect(),width=document.documentElement.clientWidth,height=innerHeight;
   const left=Math.max(4,Math.min(width-4,box.left-5)),top=Math.max(4,Math.min(height-4,box.top-5)),right=Math.max(4,Math.min(width-4,box.right+5)),bottom=Math.max(4,Math.min(height-4,box.bottom+5));
   const position=[box.left,box.top,box.width,box.height].map(n=>Math.round(n*2)/2).join(',');
   if(position!==lastBox){lastBox=position;stableSince=Date.now();}
   const settled=Date.now()-stableSince>=(reducedMotion?0:140);
   if(settled)setSettledStep(identity);
   const ph=panel.current?.offsetHeight||240,pw=Math.min(400,width-24);
   let x=Math.min(Math.max(12,left),width-pw-12),y;
   if(width<640)y=top>height/2?12:height-ph-12;
   else if(width-right>pw+24){x=right+14;y=Math.min(Math.max(12,top),height-ph-12);}
   else if(top>ph+28)y=top-ph-14;
   else y=Math.min(bottom+14,height-ph-12);
   const next={left,top,right,bottom,width,height,x,y:Math.max(12,y),pw};
   lastLayout.current=next;
   setLayout(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
   if(first&&settled&&Date.now()-scrollAt>(reducedMotion?0:250)){first=false;(current.mode==='action'&&focusables(node)[0]||panel.current)?.focus({preventScroll:true});}
  };
  let frame=0,observed=null;
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;update();observeTarget();});};
  const observer=new ResizeObserver(schedule);
  const observeTarget=()=>{if(target.current===observed)return;if(observed)observer.unobserve(observed);observed=target.current;if(observed)observer.observe(observed);};
  update();observeTarget();if(panel.current)observer.observe(panel.current);
  const timer=setInterval(schedule,180); // Fallback for async route and committed action states.
  window.addEventListener('scroll',schedule,{passive:true,capture:true});window.addEventListener('resize',schedule);
  return()=>{clearInterval(timer);clearTimeout(completionTimer);cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);};
 },[current,view?.tour,view?.index,language]);
 // Keep keyboard interaction within the guide AND its real target. Native
 // controls remain native. No body scroll lock or permanent tabindex changes.
 useEffect(()=>{
  if(!view)return;
  if(view.kind!=='run')requestAnimationFrame(()=>panel.current?.focus());
  const key=e=>{
   const dialog=document.querySelector('dialog[open]');
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dialog?.close();run.current.close();return;}
   if(dialog)return;
   if(e.key!=='Tab')return;
   const controls=[...focusables(target.current),...focusables(panel.current)];
   if(!controls.length){e.preventDefault();panel.current?.focus();return;}
   const i=controls.indexOf(document.activeElement),next=e.shiftKey?(i<=0?controls.length-1:i-1):(i+1)%controls.length;
   e.preventDefault();controls[next]?.focus();
  };
  document.addEventListener('keydown',key,true);
  return()=>document.removeEventListener('keydown',key,true);
 },[!!view]);
 useEffect(()=>{if(view?.kind==='run'&&view.tour!=='core'&&page!==view.tour){commit({...progressRef.current,pages:{...progressRef.current.pages,[view.tour]:'skipped'}});setView(null);restoreFocus();}},[page]);
 const menu=()=>{origin.current=document.activeElement;setOffer(null);setView({kind:'menu'});};
 useEffect(()=>{window.addEventListener('ddphysics:open-tutorials',menu);return()=>window.removeEventListener('ddphysics:open-tutorials',menu);},[]);
 const panelLayout=layout;
 const stepReady=view?.kind!=='run'||(layout&&settledStep===`${view.tour}:${view.index}`);
 const panelPending=view?.kind==='run'&&!stepReady&&!missing;
 const title=view?.kind==='welcome'?say(progress.status==='in-progress'?'继续上次的入门体验？':'欢迎来到 DDPhysics',progress.status==='in-progress'?'Continue your tour?':'Welcome to DDPhysics'):view?.kind==='menu'?say('使用教程','User guide'):view?.kind==='done'?say('教程结束','Tutorial complete'):current?.title[language];
 return <><button data-tour="tour-help" className="tour-help" onClick={menu}>{say('使用教程','User guide')}</button>
 {offer&&!view&&createPortal(<aside className="tour-invite" aria-label={say('页面教学','Page guide')}><span>{say('第一次来到这里？用两分钟了解操作。','New to this page? Take a short guide.')}</span><button onClick={()=>start(offer)}>{say('看看怎么用','Show me around')}</button><button aria-label={say('暂时跳过页面教学','Skip this page guide')} onClick={()=>{commit({...progressRef.current,pages:{...progressRef.current.pages,[offer]:'skipped'}});setOffer(null);}}>×</button></aside>,document.body)}
 {view&&createPortal(<div className="learning-tour" data-tour-overlay="true">
  {layout&&stepReady? <><svg className="tour-mask" aria-hidden="true"><path fillRule="evenodd" d={['M0 0','H'+layout.width,'V'+layout.height,'H0 Z','M'+layout.left+' '+layout.top,'H'+layout.right,'V'+layout.bottom,'H'+layout.left+' Z'].join(' ')}/></svg><div key={current?.id} className="tour-highlight" style={{left:layout.left,top:layout.top,width:Math.max(0,layout.right-layout.left),height:Math.max(0,layout.bottom-layout.top)}}/></>:<div className="tour-shade" style={{inset:0}}/>}
  <section ref={panel} tabIndex={-1} role="dialog" aria-modal={view.kind!=='run'||!layout?true:undefined} aria-labelledby="tour-title" aria-describedby="tour-body" aria-hidden={panelPending||undefined} className={`tour-panel ${panelLayout?'tour-positioned':''} ${panelPending?'tour-pending':''}`} style={panelLayout?{left:panelLayout.x,top:panelLayout.y,width:panelLayout.pw}:undefined} data-tour-step={current?.id||view.kind}>
   <header><span>{view.kind==='run'?say(`第 ${view.index+1} 步，共 ${steps.length} 步`,`Step ${view.index+1} of ${steps.length}`):'DDPhysics'}</span><button onClick={close} aria-label={say('退出教程','Exit tutorial')}>×</button></header>
   <h2 id="tour-title">{title}</h2>
   <div key={current?.id||view.kind} id="tour-body" aria-live="polite">
   {view.kind==='run'?<><p>{current.body[language]}</p><strong>{current.instruction[language]}</strong>{(!layout||missing)&&<p role="status">{missing?say('此区域暂不可用，可点「下一步」跳过，或点 × 退出。','This area is unavailable. Click Next to skip, or × to exit.'):say('正在加载…','Loading…')}</p>}{reviewing&&<p>{say('回看时无需重复操作。','No need to repeat the action.')}</p>}</>:view.kind==='done'?<p>{say('随时点击顶部「使用教程」重看。','Replay anytime from User guide at the top.')}</p>:view.kind==='menu'?<p>{say('边操作边学会做题、标记、知识点关联与推荐练习。','Learn questions, marks, knowledge links and recommendations by doing.')}</p>:<p>{say('跟着操作学会做题与复习。钩和星会保存真实标记，可随时退出。','Learn to practise and review. Ticks and stars save real marks. Exit anytime.')}</p>}
   {!saved&&<p role="status">{say('浏览器不允许保存进度，本次仍可使用教程。','Progress cannot be saved in this browser, but you can still use the guide.')}</p>}
   </div>
   <footer>
    {view.kind==='run'?<><Button variant="outline" disabled={view.index===0} onClick={()=>{prepare(steps[view.index-1]);setView({...view,index:view.index-1});}}>{say('上一步','Back')}</Button><Button disabled={!missing&&(!layout||(current.mode==='action'&&!reviewing))} onClick={missing?skipStep:advance}>{say('下一步','Next')}</Button></>:view.kind==='done'?<Button onClick={close}>{say('开始学习','Continue learning')}</Button>:<>{progress.status==='in-progress'&&<Button onClick={()=>start('core',true)}>{say('继续教程','Resume tour')}</Button>}<Button onClick={()=>start('core')}>{view.kind==='welcome'&&progress.status!=='in-progress'?say('开始体验','Start exploring'):say('重新开始完整教程','Restart full tour')}</Button><Button variant="ghost" onClick={close}>{say('暂时跳过','Skip for now')}</Button></>}
   </footer>
  </section>
 </div>,document.body)}
 </>;
}
