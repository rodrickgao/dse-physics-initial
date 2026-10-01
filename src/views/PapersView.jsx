import { NavigatorToggle } from '../components/NavigatorToggle';
import { SearchReturn } from '../components/SearchReturn';
import { useMembership, MemberNotice } from '../components/Membership';
import { track } from '../lib/activity';
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, Search, Star, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { StudyQuestion } from "../components/StudyQuestion";
import { SourceDownload } from "../components/SourceDownload";
import './papers-directory.css';
import { useContentMotion } from '../lib/use-content-motion';
import { cn } from "../lib/utils";
import { chapterLabel, sortKnowledge, knowledgeNumber, knowledgeTitle, imageUrl, networkFor, networkKey, questionIdentity, yearsFor } from "../lib/data";

function titleForPaper(paper, index, language) {
  if (language === "eng") return paper.title;
  return ["卷一甲部", "卷一乙部", "卷二", "考生表现报告"][index] || paper.title;
}

function ScanImages({ yearId, paths, label }) {
  if (!paths?.length) return null;
  return <div className="scan-stack">{paths.map((path, index) => <img key={path} src={imageUrl(yearId, path)} alt={`${label} ${index + 1}`} loading={index ? "lazy" : "eager"} decoding="async" />)}</div>;
}

export function PapersView({ mastered = {}, setProgress, saving, directoryVersion, onDirectory, onYearOpen, language, mistakes, setMistake, targetKey, clearTarget, initialQuery = "", openKnowledge, onQuestionChange, onAsk, onBank }) {
  const membership = useMembership();
  const reportedDirectoryVersion = useRef(directoryVersion);
  const [yearOpened, setYearOpened] = useState(Boolean(targetKey));
  useEffect(() => { setYearOpened(false); setPickerOpen(false); setQuery(''); }, [directoryVersion]);
  const years = useMemo(() => yearsFor(language), [language]);
  const [yearIndex, setYearIndex] = useState(0);
  const [paperIndex, setPaperIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [resultLimit, setResultLimit] = useState(30);
  const searchRef = useRef(null);
  const contentRef = useRef(null);
  useContentMotion(contentRef, `${yearOpened}:${yearIndex}:${paperIndex}`);
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
  const paperKeys = useMemo(() => year && paperIndex < 3 ? paper.questions.map((item, index) => networkKey(year.year, paperIndex, questionIdentity(item, index))) : [], [year, paper, paperIndex]);
  const paperMastered = paperKeys.length > 0 && paperKeys.every(itemKey => mastered[itemKey]);
  const network = year && paperIndex < 3 ? networkFor(year.year, paperIndex, question, questionIndex) : { links: [] };
  const allResults = useMemo(() => searchReady ? searchIndex.rank(searchIndex.index, query).filter(entry => !yearOpened || entry.yearIndex === yearIndex) : [], [searchIndex, searchReady, query, yearOpened, yearIndex]);
  const results = allResults.slice(0, resultLimit);
  useEffect(() => { if (reportedDirectoryVersion.current !== directoryVersion) { reportedDirectoryVersion.current = directoryVersion; return; } if (yearOpened && key && !targetKey) onQuestionChange?.(key); }, [key, targetKey, onQuestionChange, yearOpened, directoryVersion]);

  const returnToDirectory = () => { setYearOpened(false); setPickerOpen(false); setQuery(''); clearTarget?.(); onDirectory?.(); };
  const selectYear = (index) => { const selected=years[index]; setYearOpened(true); setQuery(''); setYearIndex(index); setPaperIndex(0); setQuestionIndex(0); onYearOpen?.(networkKey(selected.year,0,questionIdentity(selected.papers[0].questions[0],0))); window.scrollTo({top:0,behavior:'instant'}); };
  const selectPaper = (index) => { setPaperIndex(index); setQuestionIndex(0); };
  const selectQuestion = (index) => { setQuestionIndex(index); setPickerOpen(false); requestAnimationFrame(() => { const heading = document.getElementById('current-question'); heading?.focus({preventScroll:true}); heading?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}); }); };
  const openResult = (entry) => {
    setYearOpened(true); onYearOpen?.(entry.key); setYearIndex(entry.yearIndex); setPaperIndex(entry.paperIndex); setQuestionIndex(entry.questionIndex); setQuery(""); setPickerOpen(false);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const previous = () => questionIndex > 0 && selectQuestion(questionIndex - 1);
  const next = () => questionIndex < paper.questions.length - 1 && selectQuestion(questionIndex + 1);

  if (!year || !paper || !question) return <div className="empty-state">No paper data is available.</div>;
  return (
    <div ref={contentRef} className="papers-view page-enter">
      <div className="view-heading">
        <div className="paper-year-heading"><nav className="study-breadcrumb" aria-label="当前位置"><button onClick={onBank}>题库</button><span>›</span><button onClick={returnToDirectory}>真题库</button>{yearOpened && <><span>›</span><span>{year.year}</span></>}</nav>{!yearOpened && <h1>真题库</h1>}{yearOpened && <SourceDownload language={language} year={year.year} paper={["paper-1a", "paper-1b", "paper-2"][paperIndex]} />}{yearOpened && paperKeys.length > 0 && <Button className="paper-master-all" variant="outline" disabled={saving} aria-pressed={paperMastered} data-complete={paperMastered} title={`${year.year} · ${titleForPaper(paper, paperIndex, language)} · ${paperKeys.length} ${language === 'eng' ? 'questions' : '道题'}`} onClick={() => setProgress(paperKeys, paperMastered ? 'clear' : 'mastered')}><Check />{paperMastered ? '全卷已掌握 ✓' : '标记全卷已掌握'}</Button>}</div>
      </div>

      {!yearOpened && <section className="year-directory" aria-label="真题年份目录">{years.map((item,index)=>({item,index})).sort((a,b)=>a.item.year-b.item.year).map(({item,index})=><button className="year-directory-card" key={item.id} onClick={()=>selectYear(index)} aria-label={item.year+' 年真题'}><strong>{item.year}</strong><ArrowRight aria-hidden="true" /></button>)}</section>}
      {yearOpened && <div className="paper-layout">
        <div className={cn('navigator-shell', pickerOpen && 'is-open')}>
        <NavigatorToggle language={language} controls="paper-navigator"/><button className="mobile-picker" aria-expanded={pickerOpen} aria-controls="paper-navigator" onClick={() => setPickerOpen(!pickerOpen)}><span><small>{'选择题目'}</small><strong>{year.year} · {titleForPaper(paper, paperIndex, language)} · {question.label}</strong></span><ChevronDown/></button>
        <aside className="paper-navigator" id="paper-navigator" aria-label={'选题目录'}>
          <div className="navigator-block"><p>{"试卷"}</p><div className="paper-choice-list">{year.papers.map((item, index) => <button key={`${item.title}-${index}`} className={cn(index === paperIndex && "active")} onClick={() => selectPaper(index)}><span>{titleForPaper(item, index, language)}</span><small>{item.questions.length}</small></button>)}</div></div>
          <div className="navigator-block question-block"><p>{"题目／页数"}</p><div className={cn("question-groups", questionGroups.length > 1 && "sectioned")}>{questionGroups.map((group) => <section className="question-group" key={group.id}>{group.label && <h3>{group.label}</h3>}<div className="question-chip-grid">{group.questions.map(({ item, index }) => { const itemKey = paperIndex < 3 ? networkKey(year.year, paperIndex, questionIdentity(item, index)) : ""; return <button key={`${item.label}-${index}`} className={cn(index === questionIndex && "active", mistakes[itemKey] && "mistake", mastered[itemKey] && "mastered")} onClick={() => selectQuestion(index)}>{item.label.replace("Page ", "P")}{mastered[itemKey] && " ✓"}</button>; })}</div></section>)}</div></div>
        </aside>
        </div>

        <article className="question-card" data-study-question={key || undefined}>
          <div className="reader-utilities"><SearchReturn language={language} questionKey={key}/></div><header className="question-header" id="current-question" tabIndex={-1}>
            <div><p>{year.year} · {titleForPaper(paper, paperIndex, language)}</p><h2>{question.label}</h2></div>
            <div className="question-header-actions">
              {key && <><Button variant="outline" onClick={onAsk}>问这道题</Button><Button disabled={saving} variant={mastered[key] ? "secondary" : "outline"} aria-pressed={!!mastered[key]} onClick={()=>setProgress([key],mastered[key] ? 'clear' : 'mastered')}><Check />{mastered[key] ? "已掌握 ✓" : "标为已掌握"}</Button><Button disabled={saving} aria-pressed={!!mistakes[key]} variant={mistakes[key] ? "secondary" : "outline"} onClick={() => setMistake(key, !mistakes[key])}><Star className={cn(mistakes[key] && "fill-current")} />{mistakes[key] ? ("已加入错题") : ("加入错题")}</Button></>}
            </div>
          </header>
          <div className="question-body">
            {paperIndex < 3 ? <StudyQuestion key={`${key}-${language}`} year={year} language={language} questionKey={key} question={question} ScanImages={ScanImages}/> : <ScanImages yearId={year.id} paths={question.question} label={`${year.year} ${question.label}`} />}
            {!membership.active && <MemberNotice/>}{membership.active && !!network.links?.length && <section className="related-panel"><div><BookOpen /><strong>{"关联知识点"}</strong></div><div>{sortKnowledge(network.links,language).map((link) => <button key={`${link.sequence}-${link.type}`} onClick={() => openKnowledge(link.sequence)}><span>{knowledgeNumber(link.sequence, language)}</span> · {knowledgeTitle(link.sequence, language)}</button>)}</div></section>}
            {membership.active && !!network.relatedLinks?.length && <section className="related-panel"><div><BookOpen /><strong>定律／前置背景（不计直接题频）</strong></div><div>{sortKnowledge(network.relatedLinks,language).map(link => <button key={link.sequence} onClick={() => openKnowledge(link.sequence)}><span>{knowledgeNumber(link.sequence, language)}</span> · {knowledgeTitle(link.sequence, language)}</button>)}</div></section>}
            {membership.active && !network.links?.length && !!network.chapters?.length && <section className="related-panel"><div><BookOpen /><strong>{'相关章节'}</strong></div><div>{network.chapters.map(code => <span className="related-chapter" key={code}>{code} · {chapterLabel(code, language)}</span>)}</div></section>}
          </div>
          <footer className="question-footer"><Button variant="outline" disabled={questionIndex === 0} onClick={previous}><ArrowLeft/>{'上一题'}</Button><span>{questionIndex + 1} / {paper.questions.length}</span><Button variant="outline" disabled={questionIndex === paper.questions.length - 1} onClick={next}>{'下一题'}<ArrowRight/></Button></footer>
        </article>
      </div>}
    </div>
  );
}
