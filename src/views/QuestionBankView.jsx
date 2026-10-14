import { useEffect, useRef, useState } from "react";
import { useMembership } from '../components/Membership';
import { searchQuestions } from '../lib/question-search-loader';
import { useContentMotion } from '../lib/use-content-motion';
import { questionLabelFromKey } from '../lib/data';
import { readSaved } from '../lib/study-state';
import { readSearchSession, saveSearchSession } from '../lib/search-session';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export function QuestionBankView({ language, navigate, initialQuery = '', openQuestion, openKnowledge }) {
  const en=language==='eng', membership=useMembership();
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const [query,setQuery]=useState(()=>params.get('q')??initialQuery);
  const [data,setData]=useState(null), [error,setError]=useState(false), [retry,setRetry]=useState(0);
  const [limit,setLimit]=useState(()=>readSearchSession(membership.userId)?.hash===location.hash?readSearchSession(membership.userId).limit:30);
  const [search,setSearch]=useState(query);
  const restored=useRef(false);
  useEffect(()=>{const timer=setTimeout(()=>setSearch(query),180);return()=>clearTimeout(timer);},[query]);
  useEffect(()=>{const handler=()=>{if(location.hash.startsWith('#bank')){const p=new URLSearchParams(location.hash.split('?')[1]);setQuery(p.get('q')||'');}};addEventListener('popstate',handler);addEventListener('hashchange',handler);return()=>{removeEventListener('popstate',handler);removeEventListener('hashchange',handler);};},[]);
  useEffect(()=>{const p=new URLSearchParams({q:query});history.replaceState(history.state,'',`#bank?${p}`);},[query]);
  useEffect(()=>{
    let live=true;setData(null);setError(false);
    searchQuestions(language,search,{offset:Math.max(0,limit-30),limit:30}).then(result=>{if(live)setData(result);}).catch(()=>{if(live)setError(true);});
    return()=>{live=false;};
  },[language,membership.revision,retry,search,limit]);
  const ranked=data?.results||[];
  const results=ranked;
  const resultsRef=useRef(null);
  useContentMotion(resultsRef,`${search}:${limit}:${language}`,'',{initial:true,ready:Boolean(data)});
  const intent={concepts:[]};
  useEffect(()=>{if(!data||restored.current)return;restored.current=true;const saved=readSearchSession(membership.userId);if(saved?.hash===location.hash)requestAnimationFrame(()=>window.scrollTo({top:saved.scroll,behavior:'instant'}));},[data,membership.userId]);
  const updateQuery=value=>{setQuery(value);setLimit(30);restored.current=true;};
  const sources=[['all',en?'All':'全部'],['past-paper',en?'Past papers':'真题'],['textbook',en?'Exercises':'课本习题'],['examples',en?'Examples':'课本例题'],['knowledge',en?'Knowledge':'知识点']];
  const sourceLabel=id=>sources.find(s=>s[0]===id)?.[1]||'';
  const open=entry=>{saveSearchSession(membership.userId,{key:entry.key,hash:location.hash,scroll:scrollY,limit});entry.source==='knowledge'?openKnowledge(entry.sequence):openQuestion(entry.key);};
  const last=readSaved(`dse-last-study-${membership.userId}`,null);
  return <div className="question-bank-view page-enter">
    <div className="view-heading"><h1>{en?'Question bank':'题库'}</h1></div>
    <form className="bank-search" onSubmit={event=>{event.preventDefault();setSearch(query);}}><input data-tour="bank-search" type="search" id="bank-search" aria-label={en?'Describe what you want to practise':'描述你想练习的内容'} placeholder={en?'Describe a topic, situation or question you want to practise':'想练什么？描述知识点、情境或解题方法'} value={query} onChange={event=>updateQuery(event.target.value)}/>{query&&<button type="button" onClick={()=>updateQuery('')} aria-label={en?'Clear search':'清空搜索'}>×</button>}</form>
    {query.trim()?<section ref={resultsRef} className="bank-search-results" aria-live="polite" aria-busy={!error&&(!data||query!==search)}>
      {error?<p role="alert">{en?'Search could not be loaded.':'搜索加载失败。'}<button onClick={()=>setRetry(v=>v+1)}>{en?'Retry':'重试'}</button></p>:!data?<p role="status">{en?'Preparing question search…':'正在准备题目索引…'}</p>:<>
        <p className="search-summary">{en?'Sorted by relevance':'按相关程度排序'} · {data?.total || 0} {en?'results':'条结果'}</p>
        {!!intent.concepts.length&&<p className="search-understood">{en?'Topics recognised: ':'识别到：'}{intent.concepts.map(c=>en?c.aliases.find(a=>/^[a-z]/.test(a)):c.label).join(' · ')}</p>}
        {results.slice(0,limit).map(entry=><button className="bank-search-result" key={entry.key} onClick={()=>open(entry)}><small className="search-source">{sourceLabel(entry.source)}</small><strong>{entry.label||questionLabelFromKey(entry.key)}</strong><span>{entry.source==='knowledge'&&!membership.active?entry.chapter:entry.excerpt}</span>{!!entry.matchLabels?.length&&<small className="search-match">{en?'Related concepts':'匹配概念'} · {(en?entry.matchLabelsEn||entry.matchLabels:entry.matchLabels).slice(0,3).join(' · ')}</small>}</button>)}
        {!results.length&&<p>{en?'No results. Try fewer filters.':'暂无结果，请调整关键词或筛选。'}</p>}
        {limit>30&&<button className="search-more" onClick={()=>setLimit(v=>Math.max(30,v-30))}>{en?'Previous page':'上一页'}</button>}{data?.hasMore&&<button className="search-more" onClick={()=>setLimit(v=>v+30)}>{en?'Next page':'下一页'}</button>}
      </>}
    </section>:<>
      {last?.key&&<button className="bank-continue" onClick={()=>openQuestion(last.key)}><span>{en?'Continue learning':'继续上次学习'} · {questionLabelFromKey(last.key)}</span><ArrowRight/></button>}
      <ol className="question-bank-options bank-learning-path" aria-label={en?'Learning sequence':'学习顺序'}>{[
        {id:'examples',title:en?'Textbook examples':'课本例题',detail:en?'Learn the method with worked examples.':'看懂例题，学习解题方法。'},
        {id:'exercises',title:en?'Textbook exercises':'课本习题',detail:en?'Practise independently and consolidate each topic.':'独立练习，巩固章节知识。'},
        {id:'papers',title:en?'Past papers':'真题',detail:en?'Apply what you have learnt to exam questions.':'运用所学，练习考试题目。'}
      ].map(({id,title,detail},index)=><li key={id}><button data-tour={`bank-${id}`} className="question-bank-option" onClick={()=>navigate(id)}><span className="bank-step-number" aria-hidden="true">{index+1}</span><span className="bank-step-copy"><strong>{title}</strong><span>{detail}</span></span></button></li>)}</ol>
    </>}
  </div>;
}
export function QuestionBankBack({language,navigate}) {return <button className="question-bank-back" onClick={()=>navigate('bank')}><ArrowLeft/>{language==='eng'?'Question bank':'题库'}</button>;}
