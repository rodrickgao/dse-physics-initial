import { QuestionMarks } from '../components/QuestionMarks';
import { readerStage, isReaderReturn } from '../lib/reader-return';
import { useSourceSearch } from '../lib/use-source-search';
import { NavigatorToggle } from '../components/NavigatorToggle';
import { SearchReturn } from '../components/SearchReturn';
import { StudyContent } from '../components/StudyContent';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from '../components/ui/button';
import { STUDY_CSS } from '../lib/study-content';
import { pointsByLanguage, sortKnowledge, knowledgeTitle } from '../lib/data';
import { useMembership, MemberNotice } from '../components/Membership';

const TONES = ['#a74050','#287248','#906e0e','#396fd0','#aa5722','#009ca0','#009ca0','#009ca0','#009ca0'];
export function ExamplesView({ language, targetKey, targetBook, navigate, openKnowledge, mastered={}, mistakes={}, saving, setProgress, setMistake, onAsk }) {
  const en = language === 'eng';
  const membership=useMembership();
  const [index, setIndex] = useState(null);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [answer, setAnswer] = useState(false);
  const [thinkAnswer, setThinkAnswer] = useState(false);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setIndex(null); setError(false);
    fetch(`/api/content/directory?${new URLSearchParams({source:"examples",language,id:targetKey||""})}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Unavailable'); return r.json(); })
      .then(setIndex).catch(e => { if (e.name !== 'AbortError') setError(true); });
    return () => controller.abort();
  }, [en, retry, targetKey]);
  const selected = index?.questions.find(item => item.id === targetKey);
  const book = index?.books.find(item => selected ? item.chapters.some(c => c.id === selected.chapter) : item.id === targetBook);
  const chapter = book?.chapters.find(item => item.id === selected?.chapter);
  const items = (index?.questions || []).filter(item => item.chapter === chapter?.id);
  const relatedPoints=sortKnowledge((pointsByLanguage[language]||[]).filter(p=>(record?.knowledge||[]).includes(Number(p.sequence))),language);
  const position = items.findIndex(item => item.id === targetKey);
  useEffect(() => {
    const controller = new AbortController(); setRecord(null); setAnswer(readerStage(targetKey)>1); setThinkAnswer(readerStage(targetKey)>2); setPicker(false); setError(false);
    if (targetKey && index) {
      if (!selected) { setError(true); return; }
      fetch(`/api/content/question?${new URLSearchParams({id:targetKey,language})}`, { signal: controller.signal })
        .then(r => { if (!r.ok) throw new Error('Unavailable'); return r.json(); })
        .then(data => { setRecord(data); })
        .catch(e => { if (e.name !== 'AbortError') setError(true); });
    }
    return () => controller.abort();
  }, [targetKey, index, retry, en, membership.revision]);
  useEffect(() => {
    if (!record || isReaderReturn(targetKey)) return;
    const frame = requestAnimationFrame(() => document.querySelector('.examples-view .question-header')?.scrollIntoView({block:'start', behavior:'instant'}));
    return () => cancelAnimationFrame(frame);
  }, [record?.id]);
  const open = (id = '', book = '') => { setQuery(''); setPicker(false); navigate('examples', id, {book}); };
  const chooseChapter = code => { const firstId=index.books.flatMap(b=>b.chapters).find(c=>c.id===code)?.firstId; if(firstId)open(firstId); };
  const rich = (value,type) => <StudyContent html={value} type={type} language={language}/>;
  const search=useSourceSearch(query,language,'examples');
  const visible=search.results.map(entry=>({id:entry.key,chapter:entry.chapter,number:entry.key.split("-").at(-1),title:entry.label,preview:entry.excerpt}));
  return <div data-tour="example-state" data-ready={Boolean(index&&!error&&(!targetKey||record?.id===targetKey))} data-question={targetKey||''} data-answer={Boolean(record&&answer)} className="exercises-view examples-view page-enter">
    <style>{STUDY_CSS}</style>
    <div className="exercise-toolbar"><nav className="exercise-breadcrumb study-breadcrumb" aria-label={en ? 'Example location' : '例题位置'}>
      <button onClick={() => navigate('bank')}>{en ? 'Question bank' : '题库'}</button><ChevronRight/><button onClick={() => open()}>{en ? 'Textbook examples' : '课本例题'}</button>
      {book && <><ChevronRight/><button onClick={() => open('',book.id)}>{book.title}</button></>}
      {chapter && <><ChevronRight/><span>{chapter.id} · {chapter.title}</span></>}
    </nav></div>
    {!targetKey && <><div className="view-heading"><h1>{en ? 'Textbook examples' : '课本例题'}</h1></div><p className="examples-intro">{en ? '9 books · 46 chapters · 373 examples · English textbook content' : '9 个分册 · 46 章 · 373 道例题 · 中文课本内容'}</p><input className="example-search" type="search" aria-label={en ? 'Search examples' : '搜索例题'} placeholder={en ? 'Describe a topic, situation or method' : '描述知识点、情境或解题方法'} value={query} onChange={e => setQuery(e.target.value)}/></>}
    {error ? <div role="alert"><p>{en ? 'Unable to load this example or directory.' : '暂时无法加载例题或目录。'}</p><Button onClick={() => setRetry(v => v + 1)}>{en ? 'Retry' : '重试'}</Button><Button variant="outline" onClick={() => open()}>{en ? 'Back to directory' : '返回目录'}</Button></div>
    : !index ? <p role="status">{en ? 'Loading…' : '正在加载…'}</p>
    : !targetKey ? query.trim() ? <section className="exercise-list"><h2>{en ? 'Search results' : '搜索结果'} · {visible.length}</h2>{visible.map(item => <button key={item.id} onClick={() => open(item.id)}><strong>{item.chapter} · {en ? 'Example' : '例题'} {item.number} · {item.title}</strong><span>{item.preview}</span><ChevronRight/></button>)}{search.loading && <p role="status">{en?'Searching…':'正在搜索…'}</p>}{search.error && <p role="alert">{en?'Search unavailable. Please retry.':'搜索暂不可用，请重新搜索。'}</p>}{!search.loading && !search.error && !visible.length && <p>{en ? 'No matching examples.' : '没有找到相关例题。'}</p>}</section>
    : !book ? <section className="book-directory"><div className="book-grid">{index.books.map((item,i) => <button data-tour={`example-book-${item.id}`} key={item.id} className="book-card" style={{'--book-tone':TONES[i]}} onClick={() => open('',item.id)}><span className="book-number">{String(i+1).padStart(2,'0')}</span><span className="book-icon"><BookOpen/></span><strong>{item.title}</strong><small>{item.chapters.length} {en ? 'chapters' : '章'} · {item.count} {en ? 'examples' : '道例题'}</small></button>)}</div></section>
    : <section className="exercise-directory"><h2>{book.title}</h2>{book.chapters.map(item => <button data-tour={`example-chapter-${item.id}`} key={item.id} onClick={() => chooseChapter(item.id)}><strong>{item.id} · {item.title}</strong><small>{item.count} {en ? 'examples' : '道例题'}</small><ChevronRight/></button>)}</section>
    : <div className="paper-layout exercise-workspace">
      <div className={`navigator-shell${picker ? ' is-open' : ''}`}><NavigatorToggle language={language} controls="example-navigator"/><button className="mobile-picker" aria-expanded={picker} aria-controls="example-navigator" onClick={() => setPicker(!picker)}><span><small>{en ? 'Choose example' : '选择例题'}</small><strong>{chapter?.id} · {en ? 'Example' : '例题'} {selected?.number}</strong></span><ChevronDown/></button><aside className="paper-navigator" id="example-navigator"><div className="navigator-block question-block"><p>{en ? 'Examples' : '例题'}</p><div className="question-chip-grid">{items.map(item => <button key={item.id} aria-label={`${en ? 'Example' : '例题'} ${item.number}`} aria-current={item.id === targetKey ? 'true' : undefined} className={[item.id===targetKey&&'active',mistakes[item.id]&&'mistake',mastered[item.id]&&'mastered'].filter(Boolean).join(' ')} onClick={() => open(item.id)}>{item.number}{mastered[item.id] && " ✓"}</button>)}</div></div></aside></div>
      <article className="question-card exercise-reader" key={targetKey}><div className="reader-utilities"><SearchReturn language={language} questionKey={targetKey}/></div><header className="question-header"><div><p>{chapter?.id} · {chapter?.title}</p><h2>{en ? 'Example' : '例题'} {selected?.number}</h2><p>{selected?.title}</p></div><div className="question-header-actions"><Button variant="outline" onClick={onAsk}>{en?'Ask about this question':'问这道题'}</Button><QuestionMarks language={language} questionKey={targetKey} mastered={mastered} mistakes={mistakes} saving={saving} setProgress={setProgress} setMistake={setMistake}/></div></header><div className="question-body"><div className="study-flow" data-example={targetKey} data-focus-target={record ? `question:${targetKey}` : undefined} aria-busy={!record}>
        <section data-tour="example-question" className="study-stage"><h3><span>1</span>{en ? 'Question' : '题目'}</h3>{record ? rich(record.question,'question') : <p role="status">{en ? 'Loading…' : '正在加载…'}</p>}</section>
        <Button data-tour="example-solution" className="stage-toggle" disabled={!record} aria-expanded={answer} onClick={() => {setAnswer(!answer);setThinkAnswer(false);}}>{answer ? (en ? 'Hide solution' : '收起解答') : (en ? 'Show solution' : '查看解答')}</Button>
        {record && answer && <><section className="study-stage"><h3><span>2</span>{en ? 'Textbook solution' : '课本解答'}</h3>{rich(record.answer,'official')}</section>
          {record.tips && <section className="study-stage"><h3><span>3</span>{en ? 'Tips' : '提示'}</h3>{rich(record.tips,'reasoning')}</section>}
          {record.think && <section className="study-stage"><h3><span>{record.tips ? 4 : 3}</span>{en ? 'Think about' : '想一想'}</h3>{rich(record.think,'question')}<Button className="stage-toggle" aria-expanded={thinkAnswer} onClick={() => setThinkAnswer(!thinkAnswer)}>{thinkAnswer ? (en ? 'Hide Think about answer' : '收起思考题解答') : (en ? 'Show Think about answer' : '查看思考题解答')}</Button>{thinkAnswer && <div className="example-supplement"><h4>{en ? 'Supplementary answer' : '补充解答'}</h4>{rich(record.thinkAnswer,'official')}</div>}</section>}
        </>}
      </div>{record && relatedPoints.length>0 && <section className="related-panel"><div><BookOpen/><strong>{en?'Related knowledge':'关联知识点'}</strong></div>{record.linksAvailable?<div>{relatedPoints.map(p=><button data-tour="question-knowledge" key={p.sequence} onClick={()=>openKnowledge(p.sequence)}>{p.number} · {knowledgeTitle(p.sequence, language)}</button>)}</div>:<MemberNotice/>}</section>}</div><div className="question-footer exercise-paging"><Button variant="outline" disabled={position <= 0} onClick={() => open(items[position-1].id)}><ArrowLeft/>{en ? 'Previous' : '上一题'}</Button><span>{position+1} / {items.length}</span><Button data-tour="example-next" variant="outline" disabled={position < 0 || position === items.length-1} onClick={() => open(items[position+1].id)}>{en ? 'Next' : '下一题'}<ArrowRight/></Button></div></article>
    </div>}

  </div>;
}
