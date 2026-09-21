import { useMembership, MemberNotice } from '../components/Membership';
import { track } from '../lib/activity';
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Check, Clipboard, Download, FileQuestion, Search, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { booksFor, pointsByLanguage, questionLabelFromKey, relatedQuestionKeys, searchable, extendedPractice } from "../lib/data";

import { cn } from "../lib/utils";
import { sharedFigureCards, cardSections } from '../lib/shared-figure-cards';
import textbookDownloads from '../lib/textbook-downloads.json';
import { TextbookContent, TextbookSources } from "../components/TextbookContent";
import { useContentMotion } from "../lib/use-content-motion";

const BOOK_TONES = ["#a74050", "#287248", "#906e0e", "#396fd0", "#aa5722", "#576577", "#576577", "#576577", "#576577"];

function PointCard({ point, language, openPaper }) {
  const en = language === "eng";
  const membership = useMembership();
  const [copied, setCopied] = useState(false);
  const members = point.members || [point];
  const questionKeys = relatedQuestionKeys(members.filter(member => !member.is_governing_law).map(member => member.sequence));
  const practice = [...new Set(members.flatMap(extendedPractice))].filter(key => !questionKeys.includes(key));
  const chapters = [...new Set(members.map(member => member.chapter))];
  const books = [...new Set(members.map(member => member.book))];
  const [copyError, setCopyError] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cardSections(point).flatMap(section => [`${section.members.map(m => m.number).join(' · ')} · ${section.point.card_title || section.point.title || section.point.chapter}`, section.point.card_summary || section.point.content, ...[...new Set(section.members.flatMap(m => m.formula_latex || []))].map(f => `$${f}$`)]).join('\n'));
      setCopyError(false); setCopied(true); window.setTimeout(() => setCopied(false), 1000);
    } catch { setCopyError(true); }
  };
  return (
    <Card className="knowledge-point-card" id={`point-${point.sequence}`} data-study-knowledge-card={point.sequence} data-knowledge-sequences={members.map(member => member.sequence).join(',')} style={{ '--point-border': point.card_style?.border, '--point-tint': point.card_style?.background }}>
      <div className="knowledge-point-head">
        <div><span>{members.map(member => member.number).join(' · ')}</span><strong>{[...new Set(members.map(member => member.code))].join(' · ')}</strong></div>
        <Button variant="ghost" size="icon" onClick={copy} aria-label={en ? 'Copy knowledge card' : '复制知识点'} title={en ? 'Copy knowledge card' : '复制知识点'}>{copied ? <Check /> : <Clipboard />}</Button>
      </div>
      {copyError && <p role="status">{en ? 'Clipboard is unavailable.' : '无法使用剪贴簿。'}</p>}
      {(point.card_title || point.title) && <h3 className="textbook-card-title">{point.card_title || point.title}</h3>}
      <TextbookContent point={point} language={language} />
      {membership.active && !!practice.length && <details className="knowledge-questions"><summary>{en ? "Further practice / background applications" : "延伸练习／背景应用"} · {practice.length}{en ? " (excluded from this card’s direct question frequency)" : "（不计本卡直接题频）"}</summary><div>{practice.map(key => <button key={key} onClick={() => openPaper(key)}>{questionLabelFromKey(key)}</button>)}</div></details>}
      <div className="knowledge-meta"><span>{books.length > 1 ? books.join(' / ') : chapters.join(' / ')}</span></div>
      {!membership.active && <MemberNotice>{en ? "Members only · Related questions" : "会员专享 · 知识点关联"}</MemberNotice>}{membership.active && !!questionKeys.length && <div className="knowledge-questions"><span><FileQuestion /> {en ? "Related past-paper questions" : "相关真题"} · {questionKeys.length}</span><div>{questionKeys.slice(0, 10).map((key) => <button key={key} onClick={() => openPaper(key)}>{questionLabelFromKey(key)}</button>)}</div>{questionKeys.length > 10 && <details><summary>{language === 'eng' ? `Show ${questionKeys.length - 10} more` : `展开其余 ${questionKeys.length - 10} 题`}</summary><div>{questionKeys.slice(10).map(key => <button key={key} onClick={() => openPaper(key)}>{questionLabelFromKey(key)}</button>)}</div></details>}</div>}
      <TextbookSources point={point} language={language} />
    </Card>
  );
}

export function TextbookView({ language, targetSequence, clearTarget, openPaper }) {
  const en = language === "eng";
  const books = useMemo(() => booksFor(language), [language]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapter, setChapter] = useState("all");
  const [query, setQuery] = useState("");
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
    setSelectedBook(index); setChapter('all');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const allPoints = pointsByLanguage[language] || [];
  const normalized = searchable(query);
  const searchResults = normalized ? allPoints.filter((point) => searchable([point.number, point.sequence, point.code, point.card_title, point.title, point.chapter, point.content, point.card_summary, point.explanation_zh, ...(point.textbook_supplements || []).flatMap(s => s.source_excerpts.map(x => x.text)), point.formula, point.formula_notes, point.category_en, point.category_zh].join(" ")).includes(normalized)) : [];
  const activeBook = selectedBook === null ? null : books[selectedBook];
  const chapters = activeBook ? [...new Map(activeBook.points.map((point) => [point.code, point.chapter])).entries()] : [];
  const visiblePoints = activeBook ? activeBook.points.filter((point) => chapter === "all" || point.code === chapter) : [];
  const matches = new Set(searchResults.map(p => p.sequence));
  const searchCards = sharedFigureCards(allPoints).filter(p => (p.members || [p]).some(m => matches.has(m.sequence)) || searchable(p.card_title || p.title).includes(normalized));
  const visibleCards = sharedFigureCards(visiblePoints);
  const chapterPdf = chapter === 'all' ? null : textbookDownloads[language]?.[chapter];

  return (
    <div className="textbook-view page-enter">
      <div className="view-heading textbook-heading">
        <div><h1>{en ? "Textbook knowledge library" : "课本知识库"}</h1></div>
        <div className="textbook-count"><strong>{allPoints.length}</strong><span>{en ? "knowledge points" : "个知识点"}</span></div>
      </div>
      <div className="knowledge-search-wrap"><Search /><Input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? "Search all knowledge points" : "搜寻全部知识点"} />{query && <button onClick={() => setQuery("")}><X /></button>}</div>

      <div ref={panelRef} className="knowledge-transition">
      {query ? <section className="knowledge-search-results"><div className="directory-heading"><div><h2>{searchCards.length} {en ? "results" : "个结果"}</h2></div></div><div className="knowledge-card-list">{searchCards.map((point) => <PointCard key={point.sequence} point={point} language={language} openPaper={openPaper} />)}</div></section>
      : selectedBook === null ? <section className="book-directory">
        <div className="directory-heading"><div><h2>{en ? "Choose a textbook" : "选择课本"}</h2></div><span>{books.length} {en ? "books" : "册"}</span></div>
        <div className="book-grid">{books.map((book, index) => <button key={book.name} className="book-card" style={{ "--book-tone": BOOK_TONES[index] }} onClick={() => selectBook(index)}><span className="book-number">{String(index + 1).padStart(2, "0")}</span><span className="book-icon"><BookOpen /></span><strong>{book.name}</strong><small>{new Set(book.points.map((point) => point.code)).size} {en ? "chapters" : "章"} · {book.points.length} {en ? "knowledge points" : "个知识点"}</small></button>)}</div>
      </section>
      : <div className="textbook-browser">
        <aside className="chapter-sidebar">
          <Button variant="ghost" className="back-books" onClick={() => selectBook(null)}><ArrowLeft />{en ? "All textbooks" : "所有课本"}</Button>
          <div className="active-book-name" style={{ "--book-tone": BOOK_TONES[selectedBook] }}><span><BookOpen /></span><div><strong>{activeBook.name}</strong><small>{activeBook.points.length} {en ? "knowledge points" : "个知识点"}</small></div></div>
          <p className="chapter-label">{en ? "Chapters" : "章节"}</p>
          <div className="chapter-list"><button className={cn(chapter === "all" && "active")} onClick={() => setChapter("all")}><span>{en ? "All chapters" : "全部章节"}</span><small>{activeBook.points.length}</small></button>{chapters.map(([code, name]) => <button key={code} className={cn(chapter === code && "active")} onClick={() => setChapter(code)}><span><b>{code}</b>{name}</span><small>{activeBook.points.filter((point) => point.code === code).length}</small></button>)}</div>
        </aside>
        <section ref={chapterRef} className="knowledge-browser-content"><div className="knowledge-browser-heading"><p>{activeBook.name}</p><h2>{chapter === "all" ? (en ? "All knowledge points" : "全部知识点") : chapters.find(([code]) => code === chapter)?.[1]}</h2><span>{visibleCards.length} {en ? "cards" : "张卡片"}</span>{chapterPdf && <div className="chapter-download"><Button asChild variant="outline"><a href={chapterPdf.url} download={chapterPdf.filename}><Download aria-hidden="true" />{en ? `Download ${chapter} textbook PDF` : `下载 ${chapter} 课本 PDF`}</a></Button><small>{language === 'chn' ? '中文版' : 'English edition'} · {(chapterPdf.bytes / 1024 / 1024).toFixed(1)} MB</small></div>}</div><div className="knowledge-card-list">{visibleCards.map((point) => <PointCard key={point.sequence} point={point} language={language} openPaper={openPaper} />)}</div></section>
      </div>}
      </div>
    </div>
  );
}
