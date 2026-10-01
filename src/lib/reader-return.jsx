import {useEffect} from 'react';
const storage='dse-reader-return-v1';
const read=()=>{try{return JSON.parse(sessionStorage.getItem(storage)||'null');}catch{return null;}};
const write=value=>{try{sessionStorage.setItem(storage,JSON.stringify(value));}catch{}};
export function rememberReader(userId){
 const flow=document.querySelector('.study-flow[aria-busy="false"]');
 const key=flow?.dataset.question||flow?.dataset.exercise||flow?.dataset.example;
 if(!key)return;
 write({userId,key,hash:location.hash,scroll:scrollY,expanded:[...flow.querySelectorAll('.stage-toggle')].map(b=>b.getAttribute('aria-expanded')==='true'),pending:false});
}
export function isReaderReturn(key){const s=read();return s?.key===key&&(s.pending||Date.now()-(s.restoredAt||0)<1500);}
export function readerStage(key,fallback=1){const saved=read();return saved?.pending&&saved.key===key?(saved.expanded[1]?3:saved.expanded[0]?2:1):fallback;}
export function useReaderReturn(page,userId){
 useEffect(()=>{
 const saved=read();if(!saved?.pending||saved.userId!==userId||saved.hash!==location.hash)return;
 let cancelled=false,busy=false;
 const restore=async()=>{
  const flow=document.querySelector('.study-flow[aria-busy="false"]');
  if(busy||!flow||!(flow.dataset.question===saved.key||flow.dataset.exercise===saved.key||flow.dataset.example===saved.key))return;
  busy=true;observer.disconnect();
  await Promise.all([...flow.querySelectorAll('img')].filter(i=>!i.complete).map(i=>new Promise(resolve=>{i.addEventListener('load',resolve,{once:true});i.addEventListener('error',resolve,{once:true});setTimeout(resolve,3000);})));await document.fonts.ready;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!cancelled){window.scrollTo({top:saved.scroll,behavior:'instant'});write({...saved,pending:false,restoredAt:Date.now()});}}));
 };
 const observer=new MutationObserver(restore);observer.observe(document.querySelector('main')||document.body,{subtree:true,childList:true,attributes:true});void restore();
 return()=>{cancelled=true;observer.disconnect();};
 },[page,userId]);
}
export function ReaderReturn({userId,language}){
 const saved=read();if(!saved||saved.userId!==userId)return null;
 const label=saved.key.startsWith('ex-')?saved.key.replace(/^ex-(.+)-(\d+)$/,'$1 · E$2'):saved.key.startsWith('tb-')?saved.key.replace(/^tb-(.+)-(\d+)$/,'$1 · Q$2'):saved.key.replace('|paper-1a|',' · 1A · Q').replace('|paper-1b|',' · 1B · Q').replace('|paper-2|',' · 2 · Q');
 return <a className="reader-return" href={saved.hash} onClick={()=>write({...saved,pending:true})}>{language==='eng'?'← Back to question':'← 返回原题'} · {label}</a>;
}
