import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { entriesByLanguage, pointsByLanguage, knowledgeTitle, knowledgeNumber, questionLabelFromKey } from '../lib/data';
import { Button } from '../components/ui/button';
import './tutoring.css';

export function AskTeacherView({ language, target, openPaper, openKnowledge }) {
  const en = language === 'eng';
  const [kind,setKind]=useState(target?.kind || 'question');
  const [reference,setReference]=useState(target?.reference || '');
  const [query,setQuery]=useState('');
  const [message,setMessage]=useState('');
  const [rows,setRows]=useState([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>{ if(target){setKind(target.kind);setReference(target.reference);setQuery('');} },[target]);
  useEffect(()=>{
    let live=true;
    const refresh=()=>api('tutoring').then(data=>{if(live){setRows(data.rows);setError('');}}).catch(e=>{if(live)setError(e.message);});
    refresh(); const timer=setInterval(refresh,30000); window.addEventListener('focus',refresh);
    return ()=>{live=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[]);
  const items = kind === 'question' ? entriesByLanguage[language].map(e=>({id:e.key,label:questionLabelFromKey(e.key)})) : pointsByLanguage[language].map(p=>({id:String(p.sequence),label:`${p.number}：${knowledgeTitle(p.sequence,language)}`}));
  const choices=items.filter(item=>item.id===reference || item.label.toLowerCase().includes(query.toLowerCase()));
  const label=row=>row.kind==='question' ? questionLabelFromKey(row.reference) : row.kind==='knowledge' ? `${knowledgeNumber(row.reference,language)}：${knowledgeTitle(row.reference,language)}` : en ? 'General study question' : '通用学习问题';
  async function submit(event){
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{const result=await api('tutoring',{kind,reference:kind==='general'?'':reference,message});setRows(result.rows);setMessage('');setNotice(en?'Your question has been sent.':'问题已发送。');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="tutoring-view"><h1>{en?'Ask a teacher':'问老师'}</h1><p>{en?'Ask about a past-paper question, a knowledge point, or your study approach. Teacher replies appear below.':'可以问具体真题、课本知识点，也可以问学习方法或做题节奏。老师的回复会显示在下方。'}</p>
    <form className="tutoring-form" onSubmit={submit}><label>{en?'Question type':'提问类型'}<select value={kind} onChange={e=>{setKind(e.target.value);setReference('');setQuery('');}}><option value="question">{en?'Past-paper question':'具体真题'}</option><option value="knowledge">{en?'Textbook knowledge point':'课本知识点'}</option><option value="general">{en?'General: study methods and exam pacing':'通用问题：学习方法、做题节奏等'}</option></select></label>
    {kind!=='general' && <><label>{en?'Find a question or knowledge point':'搜索题目或知识点'}<input value={query} onChange={e=>setQuery(e.target.value)} placeholder={en?'Year, question number, or knowledge title':'年份、题号或知识点名称'}/></label><label>{en?'Choose the exact item':'选择具体内容'}<select required value={reference} onChange={e=>setReference(e.target.value)}><option value="">{en?'Please select':'请选择'}</option>{choices.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>{reference && <Button type="button" variant="outline" onClick={()=>kind==='question'?openPaper(reference):openKnowledge(reference)}>{en?'View selected content':'查看所选内容'}</Button>}</>}
    <label>{en?'Your question':'你的问题'}<textarea required maxLength={5000} rows={5} value={message} onChange={e=>setMessage(e.target.value)} placeholder={en?'Explain what you have tried and where you got stuck.':'可以说说你尝试了什么，以及哪里不明白。'}/></label><Button disabled={busy || !message.trim() || (kind!=='general'&&!reference)}>{busy?(en?'Sending…':'发送中…'):(en?'Send question':'发送问题')}</Button></form>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}<h2>{en?'My questions and teacher replies':'我的提问与老师回复'}</h2>{!rows.length&&<p>{en?'No questions yet.':'暂时没有提问。'}</p>}
    {rows.map(row=><article className="tutoring-thread" key={row.id}><div className="tutoring-thread-heading"><strong>{label(row)}</strong><span>{row.reply?(en?'Answered':'已回复'):(en?'Awaiting reply':'待回复')}</span></div>{row.kind!=='general'&&<button type="button" onClick={()=>row.kind==='question'?openPaper(row.reference):openKnowledge(row.reference)}>{en?'Open linked content':'打开关联内容'}</button>}<small>{new Date(row.created_at).toLocaleString(en?'en-HK':'zh-CN')}</small><p className="tutoring-message">{row.message}</p>{row.reply&&<div className="teacher-reply"><strong>{en?'Teacher reply':'老师回复'}</strong><p className="tutoring-message">{row.reply}</p><small>{new Date(row.replied_at).toLocaleString(en?'en-HK':'zh-CN')}</small></div>}</article>)}
  </section>;
}
