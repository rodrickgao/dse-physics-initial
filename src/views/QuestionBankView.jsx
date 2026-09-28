import { useEffect, useState } from 'react';
import { useMembership } from '../components/Membership';
import { loadUnifiedQuestionSearch } from '../lib/question-search-loader';
import { rankQuestionEntries } from '../lib/question-search';
import { questionLabelFromKey } from '../lib/data';
import { ArrowLeft, ArrowRight, BookOpen, FileQuestion } from 'lucide-react';
import './question-bank.css';

export function QuestionBankView({ language, navigate, initialQuery = '', openQuestion }) {
  const en = language === 'eng';
  const membership = useMembership();
  const [query,setQuery] = useState(initialQuery);
  const [source,setSource] = useState('all');
  const [data,setData] = useState(null);
  const [error,setError] = useState(false);
  const [retry,setRetry] = useState(0);
  const [limit,setLimit] = useState(30);
  useEffect(()=>{setQuery(initialQuery);},[initialQuery]);
  useEffect(()=>{setLimit(30);},[query,source]);
  useEffect(()=>{
    let live=true;setData(null);setError(false);
    if(query.trim()) loadUnifiedQuestionSearch(language).then(index=>{if(live)setData(index);}).catch(()=>{if(live)setError(true);});
    return ()=>{live=false;};
  },[language,!!query.trim(),membership.revision,retry]);
  const results=data ? rankQuestionEntries(data,query).filter(entry=>source==='all'||entry.source===source) : [];

  return <div className="question-bank-view page-enter">
    <div className="view-heading"><h1>{en ? 'Question bank' : '题库'}</h1></div>
    <form className="bank-search" onSubmit={event=>event.preventDefault()}><input id="bank-search" aria-label={en?'Search all questions':'搜索全部题目'} placeholder={en?'Search question text, number or topic':'搜索题目全文、题号或知识点'} value={query} onChange={event=>setQuery(event.target.value)}/>{query && <button type="button" onClick={()=>setQuery('')} aria-label={en?'Clear search':'清空搜索'}>×</button>}</form>
    <div className="bank-source-filter" role="group" aria-label={en?'Question source':'题目来源'}>{[['all',en?'All':'全部'],['past-paper',en?'Past papers':'真题'],['textbook',en?'Textbook exercises':'课本习题']].map(([id,title])=><button key={id} aria-pressed={source===id} onClick={()=>setSource(id)}>{title}</button>)}</div>
    {query.trim() ? <section className="bank-search-results" aria-live="polite">{error ? <p>{en?'Search could not be loaded.':'搜索加载失败。'}<button onClick={()=>setRetry(v=>v+1)}>{en?'Retry':'重试'}</button></p> : !data ? <p>{en?'Searching…':'正在搜索…'}</p> : <><p>{results.length} {en?'results':'条结果'}</p>{results.slice(0,limit).map(entry=><button className="bank-search-result" key={entry.key} onClick={()=>openQuestion(entry.key)}><strong>{entry.source==='textbook'?(en?'Textbook · ':'课本习题 · '):''}{questionLabelFromKey(entry.key)}</strong><span>{entry.excerpt}</span></button>)}{!results.length&&<p>{en?'Try a different keyword.':'试试其他关键词。'}</p>}{results.length>limit&&<button onClick={()=>setLimit(v=>v+30)}>{en?'Show more':'显示更多'}</button>}</>}</section> : <div className="question-bank-options">
      {[{id:'papers', title:en?'Past papers':'真题库', detail:'2012–2025', Icon:FileQuestion},
        {id:'exercises', title:en?'Textbook exercises':'课本习题库', detail:en?'9 textbooks · Chapter review exercises':'9 本课本 · 章节复习题', Icon:BookOpen}].filter(({id})=>source==='all'||(source==='past-paper'?id==='papers':id==='exercises')).map(({id,title,detail,Icon}) =>
        <button key={id} className="question-bank-option" onClick={()=>navigate(id)}><span className="library-icon"><Icon/></span><strong>{title}</strong><span>{detail}</span><ArrowRight className="question-bank-arrow"/></button>)}
    </div>}
  </div>;
}

export function QuestionBankBack({language,navigate}) {
  return <button className="question-bank-back" onClick={()=>navigate('bank')}><ArrowLeft/>{language==='eng'?'Question bank':'题库'}</button>;
}
