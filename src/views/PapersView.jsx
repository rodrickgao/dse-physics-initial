import { useMembership, MemberNotice } from '../components/Membership';
import { track } from '../lib/activity';
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Search, Star, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { StudyQuestion } from "../components/StudyQuestion";
import { SourceDownload } from "../components/SourceDownload";
import './papers-directory.css';
import { cn } from "../lib/utils";
import { chapterLabel, knowledgeNumber, knowledgeTitle, imageUrl, networkFor, networkKey, questionIdentity, yearsFor } from "../lib/data";

function titleForPaper(paper, index, language) {
  if (language === "eng") return paper.title;
  return ["卷一甲部", "卷一乙部", "卷二", "考生表现报告"][index] || paper.title;
}

function ScanImages({ yearId, paths, label }) {
  if (!paths?.length) return null;
  return <div className="scan-stack">{paths.map((path, index) => <img key={path} src={imageUrl(yearId, path)} alt={`${label} ${index + 1}`} loading={index ? "lazy" : "eager"} decoding="async" />)}</div>;
}

export function PapersView({ mastered = {}, setProgress, saving, askTeacher, directoryVersion, onDirectory, onYearOpen, language, mistakes, setMistake, targetKey, clearTarget, initialQuery = "", openKnowledge, onQuestionChange }) {
  const membership = useMembership();
  const reportedDirectoryVersion = useRef(directoryVersion);
  const [yearOpened, setYearOpened] = useState(Boolean(targetKey));
  useEffect(() => { setYearOpened(false); setPickerOpen(false); setQuery(''); }, [directoryVersion]);
  const years = useMemo(() => yearsFor(language), [language]);
  const [yearIndex, setYearIndex] = useState(0);
  const [paperIndex, setPaperIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  useEffect(() => setSelected([]),[yearIndex,paperIndex]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [resultLimit, setResultLimit] = useState(30);
  const searchRef = useRef(null);
  const [searchIndex, setSearchIndex] = useState(null);
  const [searchError, setSearchError] = useState(false);
  const [searchRetry, setSearchRetry] = useState(0);
  const hasQuery = Boolean(query.trim());
  useEffect(() => {
    if (!hasQuery) return;
    let cancelled = false;
    setSearchError(false);
    Promise.all([import('../lib/question-search-loader'), import('../lib/question-search')])
      .then(async ([loader, engine]) => ({ language, index: await loader.loadQuestionSearch(language), rank: engine.rankQuestionEntries }))
      .then(result => { if (!cancelled) setSearchIndex(result); })
      .catch(() => { if (!cancelled) setSearchError(true); });
    return () => { cancelled = true; };
  }, [language, hasQuery, searchRetry, membership.revision]);
  useEffect(() => { if (!query.trim()) return; const timer = setTimeout(() => track('search', query), 1000); return () => clearTimeout(timer); }, [query]);
  const searchReady = searchIndex?.language === language;


  useEffect(() => {
    setYearIndex((current) => Math.min(current, Math.max(0, years.length - 1)));
  }, [years]);
  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  useEffect(() => { setResultLimit(30); }, [query, language]);
  useEffect(() => {
    if (!targetKey) return;
    const [year, paperId, identity] = targetKey.split("|");
    const nextYear = years.findIndex((item) => String(item.year) === year);
    const nextPaper = ["paper-1a", "paper-1b", "paper-2"].indexOf(paperId);
    const paper = years[nextYear]?.papers[nextPaper];
    const nextQuestion = paper?.questions.findIndex((item, index) => questionIdentity(item, index) === identity) ?? -1;
    if (nextYear >= 0 && nextPaper >= 0 && nextQuestion >= 0) {
      setYearOpened(true); setYearIndex(nextYear); setPaperIndex(nextPaper); setQuestionIndex(nextQuestion);
    }
    clearTarget?.();
  }, [targetKey, years, clearTarget]);

  const year = years[yearIndex] || years[0];
  const paper = year?.papers[paperIndex] || year?.papers[0];
  const question = paper?.questions[questionIndex] || paper?.questions[0];
  const questionGroups = useMemo(() => {
    if (!paper?.questions?.length) return [];
    const hasSections = paper.questions.some((item) => item.section);
    if (!hasSections) return [{ id: "all", label: "", questions: paper.questions.map((item, index) => ({ item, index })) }];
    return [...new Set(paper.questions.map((item) => item.section).filter(Boolean))].map((section) => ({
      id: section,
      label: `Q${section}`,
      questions: paper.questions.map((item, index) => ({ item, index })).filter(({ item }) => item.section === section),
    }));
  }, [paper]);
  const key = year && paperIndex < 3 ? networkKey(year.year, paperIndex, questionIdentity(question, questionIndex)) : "";
  const network = year && paperIndex < 3 ? networkFor(year.year, paperIndex, question, questionIndex) : { links: [] };
  const allResults = useMemo(() => searchReady ? searchIndex.rank(searchIndex.index, query).filter(entry => !yearOpened || entry.yearIndex === yearIndex) : [], [searchIndex, searchReady, query, yearOpened, yearIndex]);
  const results = allResults.slice(0, resultLimit);
  useEffect(() => { if (reportedDirectoryVersion.current !== directoryVersion) { reportedDirectoryVersion.current = directoryVersion; return; } if (yearOpened && key && !targetKey) onQuestionChange?.(key); }, [key, targetKey, onQuestionChange, yearOpened, directoryVersion]);

  const returnToDirectory = () => { setYearOpened(false); setPickerOpen(false); setQuery(''); clearTarget?.(); onDirectory?.(); };
  const selectYear = (index) => { const selected=years[index]; setYearOpened(true); setQuery(''); setYearIndex(index); setPaperIndex(0); setQuestionIndex(0); onYearOpen?.(networkKey(selected.year,0,questionIdentity(selected.papers[0].questions[0],0))); window.scrollTo({top:0,behavior:'instant'}); };
  const selectPaper = (index) => { setPaperIndex(index); setQuestionIndex(0); };
  const selectQuestion = (index) => { setQuestionIndex(index); setPickerOpen(false); requestAnimationFrame(() => { const heading = document.getElementById('current-question'); heading?.focus({preventScroll:true}); heading?.scrollIntoView({block:'start',behavior:'smooth'}); }); };
  const openResult = (entry) => {
    setYearOpened(true); onYearOpen?.(entry.key); setYearIndex(entry.yearIndex); setPaperIndex(entry.paperIndex); setQuestionIndex(entry.questionIndex); setQuery(""); setPickerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const previous = () => questionIndex > 0 && selectQuestion(questionIndex - 1);
  const next = () => questionIndex < paper.questions.length - 1 && selectQuestion(questionIndex + 1);

  if (!year || !paper || !question) return <div className="empty-state">No paper data is available.</div>;
  return (
    <div className="papers-view page-enter">
      <div className="view-heading">
        <div>{yearOpened && <button type="button" className="year-back" onClick={returnToDirectory}><ArrowLeft/>全部年份</button>}<h1>{yearOpened ? `${year.year} 年真题` : "真题库"}</h1></div>
        {yearOpened && <div className="paper-progress"><strong>{questionIndex + 1}</strong><span>/ {paper.questions.length}</span></div>}
      </div>

      <div className="paper-search-wrap">
        <Search />
        <Input id="paper-search" aria-label={'搜寻真题'} ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing && results.length) { event.preventDefault(); openResult(results[0]); } }} placeholder={"输入题目中的几个字、年份或知识点"} />
        {query && <button onClick={() => setQuery("")} aria-label="Clear"><X /></button>}
      </div>
      {hasQuery && <Card className="search-results-panel" aria-label={"搜寻结果"} aria-busy={!searchReady && !searchError}>
        <div className="search-results-heading"><strong>{"搜寻结果"}</strong><span>{results.length} / {allResults.length}</span></div>
        {searchError && <p role="alert">{'未能加载题目搜寻。'}<Button variant="ghost" onClick={() => setSearchRetry(value => value + 1)}>{'重试'}</Button></p>}
        <div className="search-result-list">{!searchReady && !searchError ? <p role="status">{'正在加载题目全文…'}</p> : searchError ? null : results.length ? results.map((entry) => <button key={`${entry.key}-${entry.year.id}`} onClick={() => openResult(entry)}><span><strong>{entry.year.year} · {titleForPaper(entry.paper, entry.paperIndex, language)} · {entry.question.label}</strong><small>{entry.excerpt}</small></span><ArrowRight /></button>) : <p>{"找不到相符题目。"}</p>}</div>
        {results.length < allResults.length && <Button variant="ghost" onClick={() => setResultLimit(limit => limit + 30)}><ChevronDown />{'显示更多结果'}</Button>}
      </Card>}

      {!yearOpened && <section className="year-directory" aria-label="真题年份目录">{years.map((item,index)=>({item,index})).sort((a,b)=>a.item.year-b.item.year).map(({item,index})=><button className="year-directory-card" key={item.id} onClick={()=>selectYear(index)} aria-label={item.year+' 年真题'}><strong>{item.year}</strong></button>)}</section>}
      {yearOpened && <div className="paper-layout">
        <div className={cn('navigator-shell', pickerOpen && 'is-open')}>
        <button className="mobile-picker" aria-expanded={pickerOpen} aria-controls="paper-navigator" onClick={() => setPickerOpen(!pickerOpen)}><span><small>{'选择题目'}</small><strong>{year.year} · {titleForPaper(paper, paperIndex, language)} · {question.label}</strong></span><ChevronDown/></button>
        <aside className="paper-navigator" id="paper-navigator" aria-label={'选题目录'}>
          <div className="navigator-block"><p>{"试卷"}</p><div className="paper-choice-list">{year.papers.map((item, index) => <button key={`${item.title}-${index}`} className={cn(index === paperIndex && "active")} onClick={() => selectPaper(index)}><span>{titleForPaper(item, index, language)}</span><small>{item.questions.length}</small></button>)}</div></div>
          {paperIndex < 3 && <div className="paper-bulk"><label><input type="checkbox" checked={selected.length === paper.questions.length} onChange={e => setSelected(e.target.checked ? paper.questions.map((q,i)=>networkKey(year.year,paperIndex,questionIdentity(q,i))) : [])}/>全选本卷</label><span>{selected.length} 道已选</span><Button disabled={saving || !selected.length} onClick={()=>setProgress(selected,'mastered')}>标为已掌握</Button><Button disabled={saving || !selected.length} onClick={()=>setProgress(selected,'mistake')}>标为错题</Button><Button variant="ghost" disabled={saving || !selected.length} onClick={()=>setProgress(selected,'clear')}>清除标记</Button></div>}<div className="navigator-block question-block"><p>{"题目／页数"}</p><div className={cn("question-groups", questionGroups.length > 1 && "sectioned")}>{questionGroups.map((group) => <section className="question-group" key={group.id}>{group.label && <h3>{group.label}</h3>}<div className="question-chip-grid">{group.questions.map(({ item, index }) => { const itemKey = paperIndex < 3 ? networkKey(year.year, paperIndex, questionIdentity(item, index)) : ""; return <div className="question-chip-item" key={`${item.label}-${index}`}>{itemKey && <input type="checkbox" aria-label={`选择 ${item.label}`} checked={selected.includes(itemKey)} onChange={e=>setSelected(current=>e.target.checked ? [...current,itemKey] : current.filter(k=>k!==itemKey))}/>}<button className={cn(index === questionIndex && "active", mistakes[itemKey] && "mistake", mastered[itemKey] && "mastered")} onClick={() => selectQuestion(index)}>{item.label.replace("Page ", "P")}{mastered[itemKey] && " ✓"}</button></div>; })}</div></section>)}</div></div>
        </aside>
        </div>

        <article className="question-card">
          <header className="question-header" id="current-question" tabIndex={-1}>
            <div><p>{year.year} · {titleForPaper(paper, paperIndex, language)}</p><h2>{question.label}</h2></div>
            <div className="question-header-actions">
              <SourceDownload language={language} year={year.year} paper={["paper-1a", "paper-1b", "paper-2"][paperIndex]} />
              {key && <><Button disabled={saving} variant={mastered[key] ? "secondary" : "outline"} aria-pressed={!!mastered[key]} onClick={()=>setProgress([key],mastered[key] ? 'clear' : 'mastered')}>{mastered[key] ? '已掌握' : '标为已掌握'}</Button><Button variant="outline" onClick={()=>askTeacher('question',key)}>问老师</Button></>}{key && <Button disabled={saving} aria-pressed={!!mistakes[key]} variant={mistakes[key] ? "secondary" : "outline"} onClick={() => setMistake(key, !mistakes[key])}><Star className={cn(mistakes[key] && "fill-current")} />{mistakes[key] ? ("已加入错题") : ("加入错题")}</Button>}
              <div className="stepper"><Button variant="outline" size="icon" disabled={questionIndex === 0} onClick={previous} aria-label="Previous"><ArrowLeft /></Button><Button variant="outline" size="icon" disabled={questionIndex === paper.questions.length - 1} onClick={next} aria-label="Next"><ArrowRight /></Button></div>
            </div>
          </header>
          <div className="question-body">
            {paperIndex < 3 ? <StudyQuestion key={`${key}-${language}`} year={year} language={language} questionKey={key} question={question} ScanImages={ScanImages}/> : <ScanImages yearId={year.id} paths={question.question} label={`${year.year} ${question.label}`} />}
            {!membership.active && <MemberNotice/>}{membership.active && !!network.links?.length && <section className="related-panel"><div><BookOpen /><strong>{"相关课本知识"}</strong></div><div>{network.links.map((link) => <button key={`${link.sequence}-${link.type}`} onClick={() => openKnowledge(link.sequence)}><span>{knowledgeNumber(link.sequence, language)}</span>{knowledgeTitle(link.sequence, language)}</button>)}</div></section>}
            {membership.active && !!network.relatedLinks?.length && <section className="related-panel"><div><BookOpen /><strong>定律／前置背景（不计直接题频）</strong></div><div>{network.relatedLinks.map(link => <button key={link.sequence} onClick={() => openKnowledge(link.sequence)}><span>{knowledgeNumber(link.sequence, language)}</span>{knowledgeTitle(link.sequence, language)}</button>)}</div></section>}
            {membership.active && !network.links?.length && !!network.chapters?.length && <section className="related-panel"><div><BookOpen /><strong>{'相关章节'}</strong></div><div>{network.chapters.map(code => <span className="related-chapter" key={code}>{code} · {chapterLabel(code, language)}</span>)}</div></section>}
          </div>
          <footer className="question-footer"><Button variant="outline" disabled={questionIndex === 0} onClick={previous}><ArrowLeft/>{'上一题'}</Button><span>{questionIndex + 1} / {paper.questions.length}</span><Button variant="outline" disabled={questionIndex === paper.questions.length - 1} onClick={next}>{'下一题'}<ArrowRight/></Button></footer>
        </article>
      </div>}
    </div>
  );
}
