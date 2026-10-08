import { exerciseNumber } from '../lib/exercise-numbering';
import { QuestionMarks } from '../components/QuestionMarks';
import { readerStage, isReaderReturn } from '../lib/reader-return';
import { NavigatorToggle } from '../components/NavigatorToggle';
import { useSourceSearch } from '../lib/use-source-search';
import { SearchReturn } from '../components/SearchReturn';
import { StudyContent } from '../components/StudyContent';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, ChevronDown, Search, Check, Star } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useMembership, MemberNotice } from '../components/Membership';
import { loadExercise, loadExerciseIndex, exerciseLocation } from '../lib/textbook-exercises';
import { sortKnowledge, knowledgeNumber, knowledgeTitle, searchable } from '../lib/data';
import { STUDY_CSS } from '../lib/study-content';
import './exercises.css';

const TONES = ['#a74050','#287248','#906e0e','#396fd0','#aa5722','#009ca0','#009ca0','#009ca0','#009ca0'];
export function ExercisesView({ mastered = {}, mistakes = {}, setProgress, setMistake, saving, targetBook, language, targetKey, openExercise, openKnowledge, onAsk, onBank }) {
  const en = language === 'eng';
  const membership = useMembership();
  const [index, setIndex] = useState(null);
  const [record, setRecord] = useState(null);
  const [bookId, setBookId] = useState(targetBook || '');
  useEffect(()=>{if(!targetKey){setBookId(targetBook || '');setChapterId('');}},[targetBook,targetKey]);
  const [chapterId, setChapterId] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [stage, setStage] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    let active = true; setIndex(null); setError(false);
    loadExerciseIndex(language,targetKey).then(data => { if (active) setIndex(data); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [language, revision, membership.revision, targetKey]);
  useEffect(() => {
    let active = true; setRecord(null); setStage(readerStage(targetKey)); setError(false);
    if (targetKey && index) {
      const location = exerciseLocation(index, targetKey);
      if (!location) { setError(true); return; }
      setBookId(location.book.id); setChapterId(location.chapter.id); setQuery('');
      loadExercise(language, targetKey).then(data => { if (active) setRecord(data); }).catch(() => { if (active) setError(true); });
    }
    return () => { active = false; };
  }, [language, targetKey, index, revision, membership.revision]);
  useEffect(()=>{
    if(!record || isReaderReturn(targetKey))return;
    const frame=requestAnimationFrame(()=>document.getElementById('current-question')?.scrollIntoView({block:'start',behavior:'instant'}));
    return()=>cancelAnimationFrame(frame);
  },[record?.id]);
  const book = index?.books.find(item => item.id === bookId);
  const chapter = book?.chapters.find(item => item.id === chapterId);
  const questions = index?.questions || [];
  const chapterQuestions = questions.filter(item => item.chapter === chapterId).sort((a, b) => Number(a.number) - Number(b.number));
  const chapterLabel = item => en ? `${item.id} Review exercises` : `${item.id}复习题`;
  const selected = questions.find(item => item.id === targetKey);
  const search=useSourceSearch(query,language,'textbook');
  const visible=query.trim()?search.results.map(entry=>({id:entry.key,chapter:entry.chapter,number:entry.key.split("-").at(-1),preview:entry.excerpt})):chapterQuestions;
  const selectLevel = level => {
    openExercise('', level === 'books' ? '' : bookId); setQuery('');
    if (level === 'books') { setBookId(''); setChapterId(''); }
    if (level === 'chapters') { setChapterId(''); }
  };
  const chooseQuestion = id => { setPickerOpen(false); openExercise(id); };
  const chooseChapter = id => {
    const firstId=index.books.flatMap(b=>b.chapters).find(c=>c.id===id)?.firstId;
    if(firstId)chooseQuestion(firstId);
  };
  const siblings = chapterQuestions.map(item => item.id);
  const position = siblings.indexOf(targetKey);
  const chapterMastered = siblings.length > 0 && siblings.every(key => mastered[key]);
  const rich = (value,type) => <StudyContent html={value} type={type} language={language}/>;
  return <div data-tour={record?'exercise-ready':undefined} className="exercises-view page-enter">
    <style>{STUDY_CSS}</style>
    <div className="exercise-toolbar"><nav className="exercise-breadcrumb study-breadcrumb" aria-label={en ? 'Exercise location' : '习题位置'}>
      <button onClick={onBank}>{en?'Question bank':'题库'}</button><ChevronRight/><button onClick={() => selectLevel('books')}>{en ? 'Textbook exercises' : '课本习题'}</button>
      {book && <><ChevronRight/><button onClick={() => selectLevel('chapters')}>{book.title}</button></>}
      {chapter && <><ChevronRight/><button onClick={() => chooseChapter(chapter.id)}>{chapterLabel(chapter)}</button></>}
    </nav>
    <div className="view-heading exercise-page-heading">{!targetKey && <h1>{en ? 'Textbook exercises' : '课本习题'}</h1>}{targetKey && <div className="exercise-chapter-progress"><Button variant={chapterMastered ? 'secondary' : 'outline'} disabled={saving || !siblings.length} aria-pressed={chapterMastered} onClick={() => setProgress(siblings, chapterMastered ? 'clear' : 'mastered')}><Check/>{chapterMastered ? (en ? 'Chapter mastered' : '本章已掌握') : (en ? 'Master this chapter' : '标记本章已掌握')}</Button></div>}</div></div>

    {!targetKey && <input className="example-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} aria-label={en?'Search exercises':'搜索习题'} placeholder={en?'Describe a topic, situation or method':'描述知识点、情境或解题方法'}/>}
    {error ? <Card className="exercise-message"><p role="alert">{en ? 'Unable to load exercises.' : '暂时无法加载习题。'}</p><Button onClick={() => setRevision(v => v + 1)}>{en ? 'Retry' : '重试'}</Button></Card>
    : !index ? <p role="status">{en ? 'Loading…' : '正在加载…'}</p>
    : targetKey ? <div className="paper-layout exercise-workspace">
      <div className={`navigator-shell${pickerOpen ? ' is-open' : ''}`}>
        <NavigatorToggle language={language} controls="exercise-navigator"/><button className="mobile-picker" aria-expanded={pickerOpen} aria-controls="exercise-navigator" onClick={() => setPickerOpen(!pickerOpen)}><span><small>{en ? 'Choose question' : '选择题目'}</small><strong>{chapter?.id} · Q{exerciseNumber(selected?.id)}</strong></span><ChevronDown/></button>
        <aside className="paper-navigator" id="exercise-navigator" aria-label={en ? 'Exercise directory' : '习题目录'}>

          <div className="navigator-block question-block"><p>{en ? 'Questions' : '题目'}</p><div className="question-chip-grid">{chapterQuestions.map(item => <button key={item.id} className={[item.id === targetKey && 'active', mistakes[item.id] && 'mistake', mastered[item.id] && 'mastered'].filter(Boolean).join(' ')} aria-current={item.id === targetKey ? 'true' : undefined} onClick={() => chooseQuestion(item.id)}>Q{exerciseNumber(item.id)}{mastered[item.id] && " ✓"}</button>)}</div></div>
        </aside>
      </div>
      <article className="question-card exercise-reader" key={`${language}:${targetKey}`}>
        <div className="reader-utilities"><SearchReturn language={language} questionKey={targetKey}/></div><header className="question-header" id="current-question" tabIndex={-1}><div><p>{chapter && chapterLabel(chapter)} · {chapter?.title}</p><h2>Q{exerciseNumber(selected?.id)}</h2></div><div className="question-header-actions"><Button variant="outline" onClick={onAsk}>{en ? "Ask about this question" : "问这道题"}</Button>
          <QuestionMarks language={language} questionKey={targetKey} mastered={mastered} mistakes={mistakes} saving={saving} setProgress={setProgress} setMistake={setMistake}/>
        </div></header>
        <div className="question-body">
        <div className="study-flow" data-exercise={targetKey} data-focus-target={record ? `question:${targetKey}` : undefined} aria-busy={!record}>
          <section className="study-stage"><h3><span>1</span>{en ? 'Question' : '题目'}</h3>{record ? rich(record.question, 'question') : <p role="status">{en ? 'Loading…' : '正在加载…'}</p>}</section>
          <Button className="stage-toggle" disabled={!record} aria-expanded={stage >= 2} onClick={() => setStage(stage >= 2 ? 1 : 2)}>{stage >= 2 ? (en ? 'Hide solution' : '收起解答') : (en ? 'Show solution' : '查看解答')}</Button>
          {record && stage >= 2 && <section className="study-stage"><h3><span>2</span>{en ? 'Model answer' : '标答'}</h3>{rich(record.answer, 'official')}
            {(record.reasoning || record.hasReasoning) && <>{!membership.active && <MemberNotice>{en ? 'Members · Detailed explanations' : '会员专享 · 详解'}</MemberNotice>}<Button disabled={!membership.active} className="stage-toggle" aria-expanded={stage >= 3} onClick={() => setStage(stage >= 3 ? 2 : 3)}>{stage >= 3 ? (en ? 'Hide explanation' : '收起详解') : (en ? 'Show explanation' : '查看详解')}</Button>{membership.active && stage >= 3 && <section className="study-stage"><h3><span>3</span>{en ? 'Explanation' : '详解'}</h3>{rich(record.reasoning, 'reasoning')}</section>}</>}
          </section>}
        </div>
        <div className="knowledge-questions exercise-knowledge"><span><BookOpen/>{en ? 'Related knowledge' : '关联知识点'}</span>{record?.linksAvailable ? <div>{sortKnowledge((record?.knowledge || []),language).map(sequence => <button key={sequence} onClick={() => openKnowledge(sequence)}>{knowledgeNumber(sequence, language)} · {knowledgeTitle(sequence, language)}</button>)}</div> : <MemberNotice/>}</div>
        </div>
      <div className="question-footer exercise-paging"><Button variant="outline" disabled={position <= 0} onClick={() => chooseQuestion(siblings[position - 1])}><ArrowLeft/>{en ? 'Previous' : '上一题'}</Button><span>{position + 1} / {siblings.length}</span><Button variant="outline" disabled={position < 0 || position >= siblings.length - 1} onClick={() => chooseQuestion(siblings[position + 1])}>{en ? 'Next' : '下一题'}<ArrowRight/></Button></div>
      </article>
    </div> : query.trim() ? <section className="exercise-list"><h2>{query.trim() ? (en ? 'Search results' : '搜索结果') : chapterLabel(chapter)} <small>{visible.length} {en ? 'questions' : '题'}</small></h2>{search.loading ? <p role="status">{en?'Searching…':'正在搜索…'}</p> : search.error ? <p role="alert">{en?'Search unavailable. Please retry.':'搜索暂不可用，请重新搜索。'}</p> : visible.length ? visible.map(item => <button key={item.id} onClick={() => openExercise(item.id)}><strong>{item.chapter} · Q{exerciseNumber(item.id)}</strong><span>{item.preview}</span><ChevronRight/></button>) : <p>{en ? 'No matching exercises.' : '没有找到相关习题。'}</p>}</section>
    : !book ? <section className="book-directory"><div className="book-grid">{index.books.map((item, i) => <button key={item.id} className="book-card" style={{'--book-tone':TONES[i]}} onClick={() => openExercise('', item.id)}><span className="book-number">{String(i + 1).padStart(2,'0')}</span><span className="book-icon"><BookOpen/></span><strong>{item.title}</strong><small>{item.chapters.length} {en ? 'chapters' : '章'} · {item.count} {en ? 'exercises' : '题'}</small></button>)}</div></section>
    : <section className="exercise-directory"><h2>{book.title}</h2>{book.chapters.map(item => <button key={item.id} onClick={() => chooseChapter(item.id)}><strong>{chapterLabel(item)} · {item.title}</strong><small>{item.count} {en ? 'questions' : '题'}</small><ChevronRight/></button>)}</section>}
  </div>;
}
