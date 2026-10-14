import {useEffect,useId,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {api} from '../lib/api';
import {topicsInBookOrder} from '../lib/topic-display-order';
import {useContentMotion} from '../lib/use-content-motion';

export function HomeWeakTopics({language,revision,openKnowledge}) {
 const en=language==='eng',listId=useId(),toggle=useRef(null),pending=useRef(false),request=useRef(0);
 const [data,setData]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[expanded,setExpanded]=useState(false),[busy,setBusy]=useState(null);
 useEffect(()=>{
  let live=true;setData(null);setError('');
  const load=()=>{if(pending.current)return;const id=++request.current;api(`weak-topics?language=${language}`).then(r=>{if(live&&id===request.current){setData(r);setError('');}}).catch(e=>{if(live&&id===request.current)setError(e.message);});};
  const visible=()=>{if(!document.hidden)load();};load();
  window.addEventListener('focus',load);document.addEventListener('visibilitychange',visible);
  return()=>{live=false;request.current++;window.removeEventListener('focus',load);document.removeEventListener('visibilitychange',visible);};
 },[language,revision,retry]);
 useEffect(()=>setExpanded(false),[language]);
 const dismiss=async p=>{
  if(pending.current)return;pending.current=true;const generation=++request.current;setBusy(p.topic_key);setError('');
  try{const result=await api(`weak-topics/dismiss?language=${language}`,{knowledge_id:p.knowledge_id,revision:p.revision});if(generation===request.current)setData(result);else setRetry(v=>v+1);}
  catch(e){if(generation===request.current)setError(e.message);else setRetry(v=>v+1);}
  finally{pending.current=false;setBusy(null);}
 };
 const points=data?.weak_points||[],shown=topicsInBookOrder(expanded?points:points.slice(0,3));
 const contentRef=useRef(null);
 useContentMotion(contentRef,expanded,'',{ready:Boolean(data)});
 return <section data-tour="knowledge-profile" className="qdna-profile student-learning-guide">
  <h2>{en?'Topics to review':'薄弱知识点'}</h2>
  {error&&<p role="alert">{error} <button onClick={()=>setRetry(v=>v+1)} disabled={busy!==null}>{en?'Retry':'重试'}</button></p>}
  {!data?!error&&<p role="status">{en?'Loading…':'正在加载…'}</p>:points.length?<>
   <div ref={contentRef} id={listId} className="student-weak-points">{shown.map(p=><div className="home-weak-topic" data-review-topic={p.knowledge_id} key={p.topic_key}>
    <a href={`/#textbook?knowledge=${encodeURIComponent(p.knowledge_id)}&weakRevision=${p.revision}`} onClick={openKnowledge?e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();openKnowledge(Number(p.knowledge_id),{weakRevision:p.revision});}:undefined}>{p.number} · {p.name}</a>
    {p.can_dismiss&&<button className="weak-topic-dismiss" disabled={busy!==null} onClick={()=>dismiss(p)} aria-label={`${en?'Hide topic':'隐藏知识点'} ${p.number} · ${p.name}`} title={en?'Understood · Hide':'已理解，隐藏'}><X aria-hidden="true"/></button>}
   </div>)}</div>
   {points.length>3&&<div className="student-topic-disclosure"><button ref={toggle} aria-expanded={expanded} aria-controls={listId} onClick={()=>{setExpanded(!expanded);if(expanded)requestAnimationFrame(()=>toggle.current?.scrollIntoView({block:'nearest',behavior:'instant'}));}}><span aria-hidden="true">{expanded?'▴':'▸'}</span> {expanded?(en?'Show fewer':'收起'):(en?`Show all ${points.length} topics`:`展开全部 ${points.length} 个知识点`)}</button></div>}
  </>:<p className="qdna-note">{en?'No topics to review.':'暂无薄弱知识点。'}</p>}
 </section>;
}
