import { exerciseNumber } from '../lib/exercise-numbering';
import { useMembership, MemberNotice } from '../components/Membership';
import { loadExerciseIndex } from "../lib/textbook-exercises";
import { loadAllRelatedQuestions } from "../lib/textbook-related";
import { track } from '../lib/activity';
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Check, Clipboard, FileQuestion, Search, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { booksFor, pointsByLanguage, questionLabelFromKey, searchable } from "../lib/data";
import { cn } from "../lib/utils";
import { sharedFigureCards, cardSections } from '../lib/shared-figure-cards';
import { TextbookContent } from "../components/TextbookContent";
import { useContentMotion } from "../lib/use-content-motion";

const BOOK_TONES = ["#a74050", "#287248", "#906e0e", "#396fd0", "#aa5722", "#009ca0", "#009ca0", "#009ca0", "#009ca0"];

function PointCard({ mastered, mistakes, point, language, openPaper, exerciseIndex, exerciseError, openExercise }) {
  const en = language === "eng";
  const membership = useMembership();
  const [copied, setCopied] = useState(false);
  const members = point.members || [point];
  const linksAllowed=membership.active||members.every(p=>p.book_key==='compulsory-1');
  const [related,setRelated]=useState({results:[]});
  const [relatedError,setRelatedError]=useState(false);
  const cardRef=useRef(null);
  const memberIds=members.map(member=>member.sequence).join(',');
  useEffect(()=>{
    let live=true;const controller=new AbortController();setRelated({results:[]});setRelatedError(false);
    if(!linksAllowed)return;
    const observer=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();
      loadAllRelatedQuestions({language,points:memberIds,signal:controller.signal}).then(data=>{if(live)setRelated(data);}).catch(()=>{if(live)setRelatedError(true);});
    },{rootMargin:'200px'});if(cardRef.current)observer.observe(cardRef.current);return()=>{live=false;controller.abort();observer.disconnect();};
  },[memberIds,language,membership.revision,linksAllowed]);
  const exercises=related.results.filter(q=>q.source!=='past-paper');
  const questionKeys=related.results.filter(q=>q.source==='past-paper').map(q=>q.key);
  const [copyError, setCopyError] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText([`${point.number} · ${point.card_title || point.title || point.chapter}`, ...cardSections(point).flatMap(section => [
        ...(cardSections(point).length > 1 ? [section.point.card_title || section.point.title || section.point.chapter] : []),
        section.point.card_summary || section.point.content,
        ...(section.point.card_table ? [section.point.card_table.headers.join(' | '), ...section.point.card_table.rows.map(row => row.join(' | '))] : []),
        ...[...new Set(section.members.flatMap(m => m.formula_latex || []))].map(f => `$${f}$`),
      ])].join('\n'));
      setCopyError(false); setCopied(true); window.setTimeout(() => setCopied(false), 1000);
    } catch { setCopyError(true); }
  };
  return (
    <Card ref={cardRef} className="knowledge-point-card" id={`point-${point.sequence}`} data-tour="knowledge-card" data-study-knowledge-card={point.sequence} data-focus-target={`knowledge:${point.sequence}`} data-knowledge-sequences={members.map(member => member.sequence).join(',')} style={{ '--point-border': point.book_key?.startsWith('elective-') ? '#009ca0' : point.card_style?.border, '--point-tint': point.book_key?.startsWith('elective-') ? '#e0f4f4' : point.card_style?.background }}>
      <div className="knowledge-point-head">
        <div><span>{point.number}</span><strong>{[...new Set(members.map(member => member.code))].join(' · ')}</strong></div>
        <Button variant="ghost" size="icon" onClick={copy} aria-label={en ? 'Copy knowledge card' : '复制知识点'} title={en ? 'Copy knowledge card' : '复制知识点'}>{copied ? <Check /> : <Clipboard />}</Button>
      </div>
      {copied && <span className="sr-only" role="status">{en ? "Copied" : "已复制"}</span>}{copyError && <p role="status">{en ? 'Clipboard is unavailable.' : '无法使用剪贴簿。'}</p>}
      {(point.card_title || point.title) && <h3 className="textbook-card-title">{point.card_title || point.title}</h3>}
      <TextbookContent point={point} language={language} />
      {!linksAllowed && <MemberNotice>{en ? "Members only · Related questions" : "会员专享 · 知识点关联"}</MemberNotice>}{linksAllowed && questionKeys.length > 0 && <div data-tour="knowledge-links" className="knowledge-questions related-past-questions"><span><FileQuestion /> {en ? "Related past-paper questions" : "相关真题"} · {questionKeys.length}</span><div>{questionKeys.slice(0, 10).map((key) => <button data-tour={`knowledge-question-${point.sequence}`} key={key} data-marked={!!(mastered[key] || mistakes[key])} data-study-status={mistakes[key]?'mistake':mastered[key]?'mastered':'unmarked'} onClick={() => openPaper(key)}>{questionLabelFromKey(key)}</button>)}</div>{questionKeys.length > 10 && <details><summary>{language === 'eng' ? `Show ${questionKeys.length - 10} more` : `展开其余 ${questionKeys.length - 10} 题`}</summary><div>{questionKeys.slice(10).map(key => <button data-tour={`knowledge-question-${point.sequence}`} key={key} data-marked={!!(mastered[key] || mistakes[key])} data-study-status={mistakes[key]?'mistake':mastered[key]?'mastered':'unmarked'} onClick={() => openPaper(key)}>{questionLabelFromKey(key)}</button>)}</div></details>}</div>}
      {linksAllowed && (relatedError || exercises.length > 0) && <div className="knowledge-questions related-textbook-exercises"><span><BookOpen /> {en ? "Related exercises" : "相关习题"} · {exercises.length}</span>{relatedError ? <p>{en ? "Exercise links could not be loaded. Please refresh." : "习题关联暂时未能加载，请刷新重试。"}</p> : <><div>{exercises.slice(0,10).map(item => <button data-tour={`knowledge-question-${point.sequence}`} key={item.id} data-marked={!!(mastered[item.id] || mistakes[item.id])} data-study-status={mistakes[item.id]?'mistake':mastered[item.id]?'mastered':'unmarked'} onClick={() => item.id.startsWith('ex-') ? openPaper(item.id) : openExercise(item.id)}>{item.chapter} · {item.id.startsWith('ex-')?'E':'Q'}{item.id.startsWith('tb-')?exerciseNumber(item.id):item.number}</button>)}</div>{exercises.length > 10 && <details><summary>{en ? `Show ${exercises.length - 10} more` : `展开其余 ${exercises.length - 10} 题`}</summary><div>{exercises.slice(10).map(item => <button data-tour={`knowledge-question-${point.sequence}`} key={item.id} data-marked={!!(mastered[item.id] || mistakes[item.id])} data-study-status={mistakes[item.id]?'mistake':mastered[item.id]?'mastered':'unmarked'} onClick={() => item.id.startsWith('ex-') ? openPaper(item.id) : openExercise(item.id)}>{item.chapter} · {item.id.startsWith('ex-')?'E':'Q'}{item.id.startsWith('tb-')?exerciseNumber(item.id):item.number}</button>)}</div></details>}</>}</div>}
      {linksAllowed && relatedError && <p role="alert">{en?'Links unavailable. Please refresh.':'关联暂时无法加载，请刷新。'}</p>}
    </Card>
  );
}

export function TextbookView({ mastered = {}, mistakes = {}, language, targetSequence, clearTarget, openPaper, openExercise }) { const membership = useMembership();
  const [exerciseIndex, setExerciseIndex] = useState(null);
  const [exerciseError, setExerciseError] = useState(false);
  useEffect(() => {
    let active = true; setExerciseIndex(null); setExerciseError(false);
    if (membership.active) loadExerciseIndex(language).then(data => { if (active) setExerciseIndex(data); }).catch(() => { if (active) setExerciseError(true); });
    return () => { active = false; };
  }, [language, membership.active]);
  const en = language === "eng";
  const books = useMemo(() => booksFor(language), [language]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapter, setChapter] = useState("all");
  const [query, setQuery] = useState("");
  useEffect(()=>{
    const restore=()=>{
      if(!location.hash.startsWith('#textbook'))return;
      const params=new URLSearchParams(location.hash.split('?')[1]);
      if(params.has('knowledge'))return;
      const book=params.has('book')?Number(params.get('book')):null;
      const valid=Number.isInteger(book)&&book>=0&&book<books.length;
      const code=params.get('chapter')||'all';
      setSelectedBook(valid?book:null);
      setChapter(valid&&books[book].points.some(p=>p.code===code)?code:'all');
      setQuery('');
    };
    restore();addEventListener('popstate',restore);addEventListener('hashchange',restore);
    return()=>{removeEventListener('popstate',restore);removeEventListener('hashchange',restore);};
  },[books]);
  const rememberDirectory=(book,code='all')=>{
    const params=new URLSearchParams();if(book!==null)params.set('book',book);if(book!==null&&code!=='all')params.set('chapter',code);
    const hash='#textbook'+(params.size?'?'+params:'');if(location.hash!==hash)history.pushState({},'',hash);
  };
  useEffect(() => { if (!query.trim()) return; const timer = setTimeout(() => track('search', query), 1000); return () => clearTimeout(timer); }, [query]);
  const searchRef = useRef(null);
  const panelRef = useRef(null);
  const pendingPoint = useRef(null);
  const chapterRef = useRef(null);
  const panelKey = `${language}:${query ? 'search' : selectedBook ?? 'directory'}`;
  useContentMotion(panelRef, panelKey);
  useContentMotion(chapterRef, chapter, panelKey);

  useEffect(() => {
    if (!targetSequence) return;
    const nextBook = books.findIndex((book) => book.points.some((point) => Number(point.sequence) === Number(targetSequence)));
    const point = books[nextBook]?.points.find((item) => Number(item.sequence) === Number(targetSequence));
    if (nextBook >= 0 && point) {
      setSelectedBook(nextBook); setChapter(point.code); setQuery("");
      pendingPoint.current = targetSequence;
    }
    clearTarget?.();
  }, [targetSequence, books, clearTarget]);

  useEffect(() => {
    const target = document.getElementById(`point-${pendingPoint.current}`);
    if (!pendingPoint.current || !target) return;
    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      pendingPoint.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedBook, chapter, query, targetSequence]);

  const selectBook = (index) => {
    rememberDirectory(index);
    setSelectedBook(index); setChapter('all');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const selectChapter = (code) => {
    rememberDirectory(selectedBook,code);
    setChapter(code);
    requestAnimationFrame(() => {
      const panel = chapterRef.current;
      panel?.focus({ preventScroll: true });
      if (panel && (window.innerWidth <= 820 || panel.getBoundingClientRect().top < 76)) {
        panel.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
    });
  };

  const allPoints = pointsByLanguage[language] || [];
  const searchIndex = useMemo(() => allPoints.map(point => ({ point, text: searchable([point.number, point.sequence, point.code, point.card_title, point.title, point.chapter, point.content, point.card_summary, ...(point.card_table ? [point.card_table.label, ...point.card_table.headers, ...point.card_table.rows.flat()] : []), point.explanation_zh, ...(point.textbook_supplements || []).flatMap(s => s.source_excerpts.map(x => x.text)), point.formula, point.formula_notes, point.category_en, point.category_zh].join(" ")) })), [allPoints]);
  const allCards = useMemo(() => sharedFigureCards(allPoints).map(point => ({ point, title: searchable(point.card_title || point.title) })), [allPoints]);
  const normalized = searchable(query);
  const searchResults = normalized ? searchIndex.filter(item => item.text.includes(normalized)).map(item => item.point) : [];
  const activeBook = selectedBook === null ? null : books[selectedBook];
  const chapters = activeBook ? [...new Map(activeBook.points.map((point) => [point.code, point.chapter])).entries()] : [];
  const visiblePoints = activeBook ? activeBook.points.filter((point) => chapter === "all" || point.code === chapter) : [];
  const matches = new Set(searchResults.map(p => p.sequence));
  const searchCards = allCards.filter(({point, title}) => (point.members || [point]).some(m => matches.has(m.sequence)) || title.includes(normalized)).map(item => item.point);
  const visibleCards = sharedFigureCards(visiblePoints);

  return (
    <div className="textbook-view page-enter">
      <div className="view-heading textbook-heading">
        <div><h1>{en ? "Textbook knowledge library" : "课本知识库"}</h1></div>
        <div className="textbook-count"><strong>{allCards.length}</strong><span>{en ? "knowledge points" : "个知识点"}</span></div>
      </div>
      <div data-tour="knowledge-search" className="knowledge-search-wrap"><Search /><Input type="search" aria-label={en ? "Search knowledge points" : "搜索知识点"} ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? "Search all knowledge points" : "搜索全部知识点"} />{query && <button aria-label={en ? "Clear search" : "清空搜索"} onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X /></button>}</div>

      <div ref={panelRef} className="knowledge-transition">
      {query ? <section className="knowledge-search-results"><div className="directory-heading"><div><h2>{searchCards.length} {en ? "results" : "个结果"}</h2></div></div><div role="status" className="sr-only">{searchCards.length} {en ? "results" : "个结果"}</div>{!searchCards.length && <div className="knowledge-search-empty"><p>{en ? "No matching knowledge points. Try a chapter number or a shorter keyword." : "没有找到相关知识点，试试章节编号或更短的关键词。"}</p><Button variant="outline" onClick={() => { setQuery(""); searchRef.current?.focus(); }}>{en ? "Clear search" : "清空搜索"}</Button></div>}<div className="knowledge-card-list">{searchCards.map((point) => <PointCard mastered={mastered} mistakes={mistakes} key={point.sequence} point={point} language={language} openPaper={openPaper} exerciseIndex={exerciseIndex} exerciseError={exerciseError} openExercise={openExercise} />)}</div></section>
      : selectedBook === null ? <section className="book-directory">
        <div className="directory-heading"><div><h2>{en ? "Choose a textbook" : "选择课本"}</h2></div><span>{books.length} {en ? "books" : "册"}</span></div>
        <div className="book-grid">{books.map((book, index) => <button key={book.name} className="book-card" style={{ "--book-tone": BOOK_TONES[index] }} onClick={() => selectBook(index)}><span className="book-number">{String(index + 1).padStart(2, "0")}</span><span className="book-icon"><BookOpen /></span><strong>{book.name}</strong><small>{new Set(book.points.map((point) => point.code)).size} {en ? "chapters" : "章"} · {sharedFigureCards(book.points).length} {en ? "knowledge points" : "个知识点"}</small></button>)}</div>
      </section>
      : <div className="textbook-browser">
        <aside className="chapter-sidebar">
          <Button variant="ghost" className="back-books" onClick={() => selectBook(null)}><ArrowLeft />{en ? "All textbooks" : "所有课本"}</Button>
          <div className="active-book-name" style={{ "--book-tone": BOOK_TONES[selectedBook] }}><span><BookOpen /></span><div><strong>{activeBook.name}</strong><small>{sharedFigureCards(activeBook.points).length} {en ? "knowledge points" : "个知识点"}</small></div></div>
          <p className="chapter-label">{en ? "Chapters" : "章节"}</p>
          <div className="chapter-list"><button className={cn(chapter === "all" && "active")} aria-pressed={chapter === "all"} onClick={() => selectChapter("all")}><span>{en ? "All chapters" : "全部章节"}</span><small>{sharedFigureCards(activeBook.points).length}</small></button>{chapters.map(([code, name]) => <button key={code} className={cn(chapter === code && "active")} aria-pressed={chapter === code} onClick={() => selectChapter(code)}><span><b>{code}</b>{name}</span><small>{sharedFigureCards(activeBook.points.filter((point) => point.code === code)).length}</small></button>)}</div>
        </aside>
        <section ref={chapterRef} tabIndex={-1} className="knowledge-browser-content"><div className="knowledge-browser-heading"><p>{activeBook.name}</p><h2>{chapter === "all" ? (en ? "All knowledge points" : "全部知识点") : chapters.find(([code]) => code === chapter)?.[1]}</h2><span>{visibleCards.length} {en ? "knowledge points" : "个知识点"}</span></div><div className="knowledge-card-list">{visibleCards.map((point) => <PointCard mastered={mastered} mistakes={mistakes} key={point.sequence} point={point} language={language} openPaper={openPaper} exerciseIndex={exerciseIndex} exerciseError={exerciseError} openExercise={openExercise} />)}</div></section>
      </div>}
      </div>
    </div>
  );
}
