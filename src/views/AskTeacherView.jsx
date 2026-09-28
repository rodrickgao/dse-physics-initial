import { useDraft } from '../lib/use-draft';
import { readDraft, writeDraft } from '../lib/draft-store';
import { loadExerciseIndex, exerciseMistakeEntries } from '../lib/textbook-exercises';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { entriesByLanguage, pointsByLanguage, knowledgeTitle, knowledgeNumber, questionLabelFromKey } from '../lib/data';
import { Button } from '../components/ui/button';
import { useMembership } from '../components/Membership';
import './tutoring.css';

export function AskTeacherView(props) {
  const membership = useMembership();
  if (!membership.active) return <section className="tutoring-view"><h1>{props.language === 'eng' ? 'Ask a teacher' : '问老师'}</h1><p>{props.language === 'eng' ? 'Ask a teacher is a members-only benefit. Subscribe to ask about questions, knowledge points, or study methods.' : '问老师是会员专享功能。开通会员后，可以就题目、知识点或学习方法向老师提问。'}</p><Button asChild><a href="#membership">{props.language === 'eng' ? 'View membership' : '查看会员权益'}</a></Button></section>;
  return <MemberAskTeacherView {...props} />;
}
function MemberAskTeacherView({ language, target, openPaper, openKnowledge, userId }) {
  const en = language === 'eng';
  const initialTarget = target || readDraft(`student:${userId}:context`, {kind:'general',reference:''});
  const [exerciseEntries,setExerciseEntries] = useState([]);
  const [exerciseError,setExerciseError] = useState(false);
  const [changing,setChanging] = useState(!initialTarget?.reference);
  useEffect(()=>{let live=true;setExerciseError(false);loadExerciseIndex(language).then(index=>{if(live)setExerciseEntries(exerciseMistakeEntries(index,pointsByLanguage[language],language));}).catch(()=>{if(live)setExerciseError(true);});return()=>{live=false;};},[language]);
  const [kind,setKind]=useState(initialTarget?.kind || 'general');
  const [reference,setReference]=useState(initialTarget?.reference || '');
  const [query,setQuery]=useState('');
  const [message,setMessage,clearMessage]=useDraft(`student:${userId}:${kind}:${kind==='general'?'':reference}`);
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>{writeDraft(`student:${userId}:context`,{kind,reference});},[userId,kind,reference]);
  useEffect(()=>{ if(target){setKind(target.kind);setReference(target.reference);setQuery('');setChanging(!target.reference);} },[target]);
  useEffect(()=>{
    let live=true;
    const refresh=()=>api('tutoring').then(data=>{if(live){setRows(data.rows);setError('');}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});
    refresh(); const timer=setInterval(refresh,30000); window.addEventListener('focus',refresh);
    return ()=>{live=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[]);
  const items = kind === 'question' ? [...entriesByLanguage[language],...exerciseEntries].map(e=>({id:e.key,label:(e.source==='textbook'?(en?'Textbook · ':'课本习题 · '):'')+questionLabelFromKey(e.key)})) : pointsByLanguage[language].map(p=>({id:String(p.sequence),label:`${p.number}：${knowledgeTitle(p.sequence,language)}`}));
  const choices=[...items.filter(item=>item.id===reference),...items.filter(item=>item.id!==reference&&item.label.toLowerCase().includes(query.toLowerCase())).slice(0,40)];
  const label=row=>row.kind==='question' ? (row.reference.startsWith('tb-')?(en?'Textbook · ':'课本习题 · '):'')+questionLabelFromKey(row.reference) : row.kind==='knowledge' ? `${knowledgeNumber(row.reference,language)}：${knowledgeTitle(row.reference,language)}` : en ? 'General study question' : '通用学习问题';
  async function submit(event){
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{const result=await api('tutoring',{kind,reference:kind==='general'?'':reference,message});setRows(result.rows);clearMessage();setNotice(en?'Your question has been sent.':'问题已发送。');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="tutoring-view"><h1>{en?'Ask a teacher':'问老师'}</h1><p>{en?'Ask about a question, a knowledge point or your studies. Replies appear below.':'可以问真题、课本习题或知识点，回复会显示在下方。'}</p>
    <form className="tutoring-form" onSubmit={submit}>{reference && !changing && <div className="ask-context"><strong>{label({kind,reference})}</strong><Button type="button" variant="ghost" onClick={()=>setChanging(true)}>{en?'Change':'更换题目'}</Button></div>}{(!reference || changing) && <><label>{en?'Question type':'提问类型'}<select value={kind} onChange={e=>{setKind(e.target.value);setReference('');setQuery('');}}><option value="question">{en?'Question':'题目（真题／课本习题）'}</option><option value="knowledge">{en?'Textbook knowledge point':'课本知识点'}</option><option value="general">{en?'General: study methods and exam pacing':'通用问题：学习方法、做题节奏等'}</option></select></label>
    {kind!=='general' && <><label>{en?'Find a question or knowledge point':'搜索题目或知识点'}<input value={query} onChange={e=>setQuery(e.target.value)} placeholder={en?'Year, question number, or knowledge title':'年份、题号或知识点名称'}/></label><label>{en?'Choose the exact item':'选择具体内容'}<select required value={reference} onChange={e=>{setReference(e.target.value);setChanging(!e.target.value);}}><option value="">{en?'Please select':'请选择'}</option>{choices.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>{reference && <Button type="button" variant="outline" onClick={()=>kind==='question'?openPaper(reference):openKnowledge(reference)}>{en?'View selected content':'查看所选内容'}</Button>}</>}
    </>}<label>{en?'Your question':'你的问题'}<textarea required maxLength={5000} rows={5} value={message} onChange={e=>setMessage(e.target.value)} placeholder={en?'Explain what you have tried and where you got stuck.':'可以说说你尝试了什么，以及哪里不明白。'}/></label>{message && <small role="status">{en?'Draft kept in this browser tab.':'草稿已在当前浏览器标签页保留。'}</small>}<Button disabled={busy || !message.trim() || (kind!=='general'&&!reference)}>{busy?(en?'Sending…':'发送中…'):(en?'Send question':'发送问题')}</Button></form>
    {exerciseError&&changing&&<p role="alert">{en?'Textbook choices could not be loaded. Refresh to try again.':'课本习题列表未能加载，请刷新重试。'}</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}<h2>{en?'My questions and teacher replies':'我的提问与老师回复'}</h2>{loading && <p role="status">{en ? "Loading your questions…" : "正在加载提问记录…"}</p>}{!loading&&!error&&!rows.length&&<p>{en?'No questions yet.':'暂时没有提问。'}</p>}
    {rows.map(row=><article className="tutoring-thread" key={row.id}><div className="tutoring-thread-heading"><strong>{label(row)}</strong><span>{row.reply?(en?'Answered':'已回复'):(en?'Awaiting reply':'待回复')}</span></div>{row.kind!=='general'&&<button type="button" onClick={()=>row.kind==='question'?openPaper(row.reference):openKnowledge(row.reference)}>{en?'Open linked content':'打开关联内容'}</button>}<small>{new Date(row.created_at).toLocaleString(en?'en-HK':'zh-CN')}</small><p className="tutoring-message">{row.message}</p>{row.reply&&<div className="teacher-reply"><strong>{en?'Teacher reply':'老师回复'}</strong><p className="tutoring-message">{row.reply}</p><small>{new Date(row.replied_at).toLocaleString(en?'en-HK':'zh-CN')}</small></div>}</article>)}
  </section>;
}
