import { useMembership } from '../components/Membership';
import { teacherQuestionLocation } from '../lib/teacher-question-location';
import { exerciseNumber } from '../lib/exercise-numbering';
import { useDraft } from '../lib/use-draft';
import { readDraft, writeDraft } from '../lib/draft-store';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { entriesByLanguage, pointsByLanguage, cardsByLanguage, booksFor, knowledgeTitle, knowledgeNumber, questionLabelFromKey } from '../lib/data';
import { Button } from '../components/ui/button';

export function AskTeacherView(props) {
  const membership = useMembership();
  if (!membership.active) return <section className="tutoring-view"><h1>{props.language === 'eng' ? 'Ask a teacher' : '问老师'}</h1><p>{props.language === 'eng' ? 'Ask a teacher is a members-only benefit. Subscribe to ask about questions, knowledge points, or study methods.' : '问老师是会员专享功能。开通会员后，可以就题目、知识点或学习方法向老师提问。'}</p><Button asChild><a href="#membership">{props.language === 'eng' ? 'View membership' : '查看会员权益'}</a></Button></section>;
  return <MemberAskTeacherView {...props} />;
}
function MemberAskTeacherView({ language, target, openPaper, openKnowledge, userId }) {
  const en = language === 'eng';
  const initialTarget = target || readDraft(`student:${userId}:context`, {kind:'general',reference:''});
  const initialKnowledge=initialTarget.kind==='knowledge' ? pointsByLanguage[language].find(point=>String(point.sequence)===initialTarget.reference) : null;
  const initialQuestion=initialTarget.kind==='question'?teacherQuestionLocation(initialTarget.reference):null;
  const [changing,setChanging] = useState(!initialTarget?.reference);
  const [kind,setKind]=useState(initialTarget?.kind || 'general');
  const [reference,setReference]=useState(initialTarget?.reference || '');
  const [bookKey,setBookKey]=useState(initialKnowledge?.book_key || initialQuestion?.bookKey || initialTarget?.bookKey || '');
  const [chapterCode,setChapterCode]=useState(initialKnowledge?.code || initialQuestion?.chapterCode || initialTarget?.chapterCode || '');
  const [questionSource,setQuestionSource]=useState(initialQuestion?.source || initialTarget?.questionSource || '');
  const [questionYear,setQuestionYear]=useState(initialQuestion?.year || initialTarget?.questionYear || '');
  const [questionPaper,setQuestionPaper]=useState(initialQuestion?.paper || initialTarget?.questionPaper || '');
  const [directory,setDirectory]=useState(null);
  const [directoryError,setDirectoryError]=useState('');
  const [directoryRetry,setDirectoryRetry]=useState(0);
  const [message,setMessage,clearMessage]=useDraft(`student:${userId}:${kind}:${kind==='general'?'':reference}`);
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const selectedPoint=kind==='knowledge' ? pointsByLanguage[language].find(point=>String(point.sequence)===reference) : null;
  const selectedQuestion=kind==='question'?teacherQuestionLocation(reference):null;
  const selectedSource=selectedQuestion?.source || questionSource;
  const selectedYear=selectedQuestion?.year || questionYear;
  const selectedPaper=selectedQuestion?.paper || questionPaper;
  const selectedBook=selectedPoint?.book_key || selectedQuestion?.bookKey || bookKey;
  const selectedChapter=selectedPoint?.code || selectedQuestion?.chapterCode || chapterCode;
  const books=booksFor(language);
  const book=books.find(book=>book.key===selectedBook);
  const chapters=[...new Map((book?.points || []).map(point=>[point.code,point.chapter])).entries()];
  const knowledgeChoices=cardsByLanguage[language].filter(card=>card.book_key===selectedBook&&card.code===selectedChapter);
  const pastEntries=entriesByLanguage[language];
  const years=[...new Set(pastEntries.map(entry=>String(entry.year.year)))].sort((a,b)=>Number(a)-Number(b));
  const papers=['paper-1a','paper-1b','paper-2'].filter(paper=>pastEntries.some(entry=>String(entry.year.year)===selectedYear&&entry.key.split('|')[1]===paper));
  const directoryKey=`${language}:${selectedSource}:${selectedChapter}`;
  useEffect(()=>{
    if(kind!=='question'||!['examples','textbook'].includes(selectedSource)||!selectedChapter){setDirectory(null);setDirectoryError('');return;}
    const controller=new AbortController();setDirectory(null);setDirectoryError('');
    (async()=>{const questions=[];let offset=0,more;
      do{const response=await fetch(`/api/content/directory?${new URLSearchParams({source:selectedSource,language,chapter:selectedChapter,offset,limit:50})}`,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json();questions.push(...data.questions);offset+=data.questions.length;more=data.hasMore;if(more&&!data.questions.length)throw new Error();}while(more);
      if(!controller.signal.aborted)setDirectory({key:directoryKey,questions});
    })().catch(error=>{if(error.name!=='AbortError')setDirectoryError(directoryKey);});
    return()=>controller.abort();
  },[kind,language,selectedSource,selectedChapter,directoryRetry]);
  const questionChoices=selectedSource==='past-paper'?pastEntries.filter(entry=>String(entry.year.year)===selectedYear&&entry.key.split('|')[1]===selectedPaper).map(entry=>({id:entry.key,number:entry.key.split('|')[2]})):directory?.key===directoryKey?directory.questions.map(question=>({id:question.id,number:selectedSource==='textbook'?exerciseNumber(question.id):question.number})):[];
  useEffect(()=>{writeDraft(`student:${userId}:context`,{kind,reference,...(['knowledge','question'].includes(kind)?{bookKey:selectedBook,chapterCode:selectedChapter}:{}),...(kind==='question'?{questionSource:selectedSource,questionYear:selectedYear,questionPaper:selectedPaper}:{})});},[userId,kind,reference,selectedBook,selectedChapter,selectedSource,selectedYear,selectedPaper]);
  useEffect(()=>{ if(target){const point=target.kind==='knowledge'?pointsByLanguage[language].find(point=>String(point.sequence)===target.reference):null,question=target.kind==='question'?teacherQuestionLocation(target.reference):null;setKind(target.kind);setReference(target.reference);setBookKey(point?.book_key || question?.bookKey || '');setChapterCode(point?.code || question?.chapterCode || '');setQuestionSource(question?.source || '');setQuestionYear(question?.year || '');setQuestionPaper(question?.paper || '');setChanging(!target.reference);} },[target]);
  useEffect(()=>{
    let live=true;
    const refresh=()=>api('tutoring').then(data=>{if(live){setRows(data.rows);setError('');}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});
    refresh(); const timer=setInterval(refresh,30000); window.addEventListener('focus',refresh);
    return ()=>{live=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[]);
  const label=row=>row.kind==='question' ? (row.reference.startsWith('tb-')?(en?'Textbook · ':'课本习题 · '):'')+questionLabelFromKey(row.reference) : row.kind==='knowledge' ? `${knowledgeNumber(row.reference,language)}：${knowledgeTitle(row.reference,language)}` : en ? 'General study question' : '通用学习问题';
  async function submit(event){
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{const result=await api('tutoring',{kind,reference:kind==='general'?'':reference,message});setRows(result.rows);clearMessage();setNotice(en?'Your question has been sent.':'问题已发送。');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="tutoring-view"><h1>{en?'Ask a teacher':'问老师'}</h1>
    <form data-tour="teacher-form" className="tutoring-form" onSubmit={submit}>{reference && !changing && <div className="ask-context"><strong>{label({kind,reference})}</strong><Button type="button" variant="ghost" onClick={()=>setChanging(true)}>{en?'Change':'更换题目'}</Button></div>}{(!reference || changing) && <><label>{en?'Question type':'提问类型'}<select value={kind} onChange={e=>{setKind(e.target.value);setReference('');setBookKey('');setChapterCode('');setQuestionSource('');setQuestionYear('');setQuestionPaper('');}}><option value="question">{en?'Question':'题目'}</option><option value="knowledge">{en?'Textbook knowledge point':'课本知识点'}</option><option value="general">{en?'General: study methods and exam pacing':'通用问题：学习方法、做题节奏等'}</option></select></label>
    {kind==='knowledge' && <><label>{en?'Textbook':'课本'}<select data-teacher="book" required value={selectedBook} onChange={e=>{setBookKey(e.target.value);setChapterCode('');setReference('');}}><option value="">{en?'Choose a textbook':'选择课本'}</option>{books.map(book=><option key={book.key} value={book.key}>{book.name}</option>)}</select></label>{selectedBook && <label>{en?'Chapter':'章节'}<select data-teacher="chapter" required value={selectedChapter} onChange={e=>{setChapterCode(e.target.value);setReference('');}}><option value="">{en?'Choose a chapter':'选择章节'}</option>{chapters.map(([code,name])=><option key={code} value={code}>{code} · {name}</option>)}</select></label>}{selectedChapter && <label>{en?'Knowledge point':'知识点'}<select data-teacher="knowledge" required value={reference} onChange={e=>{setReference(e.target.value);setChanging(!e.target.value);}}><option value="">{en?'Choose a knowledge point':'选择知识点'}</option>{knowledgeChoices.map(card=>{const id=String(selectedPoint?.card_sequence===card.sequence?selectedPoint.sequence:card.sequence);return <option key={card.sequence} value={id}>{card.number}：{knowledgeTitle(card.sequence,language)}</option>;})}</select></label>}</>}
    {kind==='question' && <>
      <label>{en?'Question source':'题目来源'}<select data-teacher="source" required value={selectedSource} onChange={e=>{setQuestionSource(e.target.value);setQuestionYear('');setQuestionPaper('');setBookKey('');setChapterCode('');setReference('');}}><option value="">{en?'Choose a question source':'选择题目来源'}</option><option value="past-paper">{en?'Past papers':'真题'}</option><option value="examples">{en?'Textbook examples':'课本例题'}</option><option value="textbook">{en?'Textbook exercises':'课本习题'}</option></select></label>
      {selectedSource==='past-paper' && <>
        <label>{en?'Year':'年份'}<select data-teacher="year" required value={selectedYear} onChange={e=>{setQuestionYear(e.target.value);setQuestionPaper('');setReference('');}}><option value="">{en?'Choose a year':'选择年份'}</option>{years.map(year=><option key={year} value={year}>{year}</option>)}</select></label>
        {selectedYear && <label>{en?'Paper':'试卷'}<select data-teacher="paper" required value={selectedPaper} onChange={e=>{setQuestionPaper(e.target.value);setReference('');}}><option value="">{en?'Choose a paper':'选择试卷'}</option>{papers.map(paper=><option key={paper} value={paper}>{(en?{'paper-1a':'Paper 1A','paper-1b':'Paper 1B','paper-2':'Paper 2'}:{'paper-1a':'卷一甲部','paper-1b':'卷一乙部','paper-2':'卷二'})[paper]}</option>)}</select></label>}
      </>}
      {['examples','textbook'].includes(selectedSource) && <>
        <label>{en?'Textbook':'课本'}<select data-teacher="question-book" required value={selectedBook} onChange={e=>{setBookKey(e.target.value);setChapterCode('');setReference('');}}><option value="">{en?'Choose a textbook':'选择课本'}</option>{books.map(book=><option key={book.key} value={book.key}>{book.name}</option>)}</select></label>
        {selectedBook && <label>{en?'Chapter':'章节'}<select data-teacher="question-chapter" required value={selectedChapter} onChange={e=>{setChapterCode(e.target.value);setReference('');}}><option value="">{en?'Choose a chapter':'选择章节'}</option>{chapters.map(([code,name])=><option key={code} value={code}>{code} · {name}</option>)}</select></label>}
      </>}
      {(selectedSource==='past-paper'?selectedYear&&selectedPaper:['examples','textbook'].includes(selectedSource)&&selectedBook&&selectedChapter) && <label>{en?'Question number':'题号'}<select data-teacher="question" required disabled={selectedSource!=='past-paper'&&directory?.key!==directoryKey} value={reference} onChange={e=>{setReference(e.target.value);setChanging(!e.target.value);}}><option value="">{en?'Choose a question':'选择题号'}</option>{questionChoices.map(item=><option key={item.id} value={item.id}>{en?`${selectedSource==='examples'?'Example':'Q'} ${item.number}`:`${selectedSource==='examples'?'例题':'第'} ${item.number}${selectedSource==='examples'?'':' 题'}`}</option>)}</select>{selectedSource!=='past-paper'&&directory?.key!==directoryKey&&(directoryError===directoryKey?<span role="alert">{en?'Could not load questions.':'题目列表加载失败。'} <Button type="button" variant="ghost" onClick={()=>setDirectoryRetry(value=>value+1)}>{en?'Retry':'重试'}</Button></span>:<span role="status">{en?'Loading…':'加载中…'}</span>)}</label>}
    </>}{reference && <Button type="button" variant="outline" onClick={()=>kind==='question'?openPaper(reference):openKnowledge(reference)}>{en?'View selected content':'查看所选内容'}</Button>}
    </>}<label>{en?'Your question':'你的问题'}<textarea data-tour="teacher-message" required maxLength={5000} rows={5} value={message} onChange={e=>setMessage(e.target.value)} placeholder={en?'Explain what you have tried and where you got stuck.':'可以说说你尝试了什么，以及哪里不明白。'}/></label>{message && <small role="status">{en?'Draft kept in this browser tab.':'草稿已在当前浏览器标签页保留。'}</small>}<Button disabled={busy || !message.trim() || (kind!=='general'&&!reference)}>{busy?(en?'Sending…':'发送中…'):(en?'Ask a teacher':'问老师')}</Button></form>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}<h2>{en?'My questions and teacher replies':'我的提问与老师回复'}</h2>{loading && <p role="status">{en ? "Loading your questions…" : "正在加载提问记录…"}</p>}{!loading&&!error&&!rows.length&&<p>{en?'No questions yet.':'暂时没有提问。'}</p>}
    {rows.map(row=><article className="tutoring-thread" key={row.id}><div className="tutoring-thread-heading"><strong>{label(row)}</strong><span>{row.reply?(en?'Answered':'已回复'):(en?'Awaiting reply':'待回复')}</span></div>{row.kind!=='general'&&<button type="button" onClick={()=>row.kind==='question'?openPaper(row.reference):openKnowledge(row.reference)}>{en?'Open linked content':'打开关联内容'}</button>}<small>{new Date(row.created_at).toLocaleString(en?'en-HK':'zh-CN')}</small><p className="tutoring-message">{row.message}</p>{row.reply&&<div className="teacher-reply"><strong>{en?'Teacher reply':'老师回复'}</strong><p className="tutoring-message">{row.reply}</p><small>{new Date(row.replied_at).toLocaleString(en?'en-HK':'zh-CN')}</small></div>}</article>)}
  </section>;
}
