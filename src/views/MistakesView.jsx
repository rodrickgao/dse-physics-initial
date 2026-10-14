import { exerciseNumber } from '../lib/exercise-numbering';
import { exampleEntries } from '../lib/textbook-examples';
import { MistakeStatistics } from '../components/MistakeStatistics';
import { useContentMotion } from '../lib/use-content-motion';
import { mistakeBookDistribution } from '../lib/mistake-book-distribution';
import { MistakeTrash } from '../components/MistakeTrash';
import { useMembership, MemberNotice } from "../components/Membership";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDialogFocus } from '../lib/use-dialog-focus';
import { ArrowRight, BarChart3, BookOpen, CircleAlert, Download, LoaderCircle, Star, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { entriesByLanguage, sortKnowledge, knowledgeNumber, pointsByLanguage, questionLabelFromKey, booksFor } from "../lib/data";
import { openMistakePrint, compareMistakePrintEntries } from "../lib/study-content";

function readReviewFilter() {
  const params = new URLSearchParams(location.hash.split('?')[1]);
  const topic = params.get('topic');
  if (topic === 'unclassified') return {kind:'topic',value:0};
  if (topic && /^\d+$/.test(topic) && Number(topic)>0) return {kind:'topic',value:Number(topic)};
  const point = Number(params.get('point'));
  if (Number.isInteger(point) && point > 0) return {kind:'point',value:point};
  const chapter = params.get('chapter');
  if (chapter && /^(?:[A-Za-z0-9.]+|unclassified)$/.test(chapter)) return {kind:'chapter',value:chapter};
  const book = params.get('book');
  return /^(?:compulsory-[1-5]|elective-[1-4])$/.test(book || '') ? {kind:'book',value:book} : null;
}

function statisticsBookFor(filter, language) {
  if (filter?.kind === 'book') return filter.value;
  if (filter?.kind !== 'chapter') return 'all';
  if (filter.value === 'unclassified') return 'unclassified';
  return booksFor(language).find(book => book.points.some(point => point.code === filter.value))?.key || 'all';
}

export function MistakesView({ mastered, setProgress, saving, language, mistakes, setMistake, openPaper, browsePapers, manageTrash, openKnowledge }) {
  const en = language === 'eng';
  const membership = useMembership();
  const [filter, setFilter] = useState(readReviewFilter);
  useEffect(() => {
    const restore = () => { if (location.hash.split('?')[0] === '#mistakes') { const next = readReviewFilter(); setFilter(next); setStatisticsBook(statisticsBookFor(next, language)); setSelected(null); } };
    addEventListener('popstate',restore); addEventListener('hashchange',restore);
    return () => { removeEventListener('popstate',restore); removeEventListener('hashchange',restore); };
  }, [language]);
  const [statisticsBook, setStatisticsBook] = useState(() => statisticsBookFor(readReviewFilter(), language));
  const filterPosition = useRef(null);
  const filterMinimumHeight = useRef(0);
  const rememberFilterPosition = () => {
    const selector = document.getElementById('statistics-book');
    filterPosition.current = selector ? selector.getBoundingClientRect().top : null;
    if (selector) filterMinimumHeight.current = selector.closest('.mistakes-view').offsetHeight;
  };
  useLayoutEffect(() => {
    if (filterPosition.current === null) return;
    const selector = document.getElementById('statistics-book');
    const previousTop = filterPosition.current;
    filterPosition.current = null;
    if (!selector) return;
    const view = selector.closest('.mistakes-view');
    const target = Math.max(0, selector.getBoundingClientRect().top + window.scrollY - previousTop);
    // Leave only the space needed to hold this position when results get shorter.
    const viewTop = view.getBoundingClientRect().top + window.scrollY;
    filterMinimumHeight.current = Math.max(0, Math.ceil(target + window.innerHeight - viewTop));
    view.style.minHeight = `${filterMinimumHeight.current}px`;
    window.scrollTo({ top: target, behavior: 'instant' });
  }, [filter, statisticsBook]);
  const [view, setView] = useState('active');
  const [loadError, setLoadError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [selected, setSelected] = useState(null);
  const [deleteKeys, setDeleteKeys] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteDialog = useRef(null);
  const deletePending = useRef(false);
  const closeDeleteDialog = useCallback(() => setDeleteKeys(null), []);
  useDialogFocus(deleteDialog, Boolean(deleteKeys), closeDeleteDialog, deleting || saving);
  const deleteAll = async () => {
    if (!deleteKeys?.length || deletePending.current || saving) return;
    deletePending.current = true;
    setDeleting(true); setDeleteError('');
    try {
      if (await manageTrash('trash', deleteKeys)) {
        setDeleteKeys(null); clearFilter();
      } else setDeleteError(en ? 'Unable to delete. Please retry.' : '删除失败，请重试。');
    } catch {
      setDeleteError(en ? 'Unable to delete. Please retry.' : '删除失败，请重试。');
    } finally { deletePending.current = false; setDeleting(false); }
  };
  const exerciseEntries = Object.keys(mistakes).filter(key=>key.startsWith('tb-')).map(key=>({key,source:'textbook',exerciseChapter:key.split('-')[1],year:{year:0,id:''},paperIndex:1,questionIndex:Number(key.split('-').at(-1)),question:{label:'Q'+exerciseNumber(key),kind:'structured'},paper:{title:en?'Textbook exercises':'课本习题'},chapter:key.split('-')[1],network:{links:[]}}));
  const map = new Map([...entriesByLanguage[language], ...exerciseEntries, ...exampleEntries(pointsByLanguage[language],language)].map(entry => [entry.key, entry]));
  const [summary,setSummary]=useState(null);
  const summaryPoint = filter?.kind === 'point' && membership.active ? filter.value : null;
  const contentRef = useRef(null);
  useContentMotion(contentRef, `${language}:${view}`, '', { initial: true, ready: summary?.language === language });
  const order = new Map((summary?.orderedKeys || []).map((key,index)=>[key,index]));
  const entries = Object.keys(mistakes).filter(key => map.has(key)).map(key => ({...map.get(key), question:{...map.get(key).question,kind:summary?.questionKinds?.[key] || map.get(key).question.kind}, mistakeOrder: order.get(key), markedAt: mistakes[key].markedAt, sortChapter: mistakes[key].chapterCode, primaryChapterCode: mistakes[key].primaryChapterCode})).sort(compareMistakePrintEntries(pointsByLanguage[language]));
  useEffect(()=>{let live=true;setSummary(null);setLoadError('');const params=new URLSearchParams({language});if(summaryPoint!==null)params.set('point',summaryPoint);fetch(`/api/content/mistake-summary?${params}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(live)setSummary({...data,language});}).catch(()=>{if(live)setLoadError(en?'Unable to load mistakes. Please retry.':'错题加载失败，请重试。');});return()=>{live=false;};},[language,mistakes,summaryPoint,membership.active,membership.revision,loadVersion]);
  const analysis = {knowledgeDistribution:[],...(summary || {chapters:[],recommendations:[],pointCount:0})};
  const chapters = analysis.chapters.map(row => [row.name, row.keys.length]);
  const distribution = mistakeBookDistribution(analysis.chapters, booksFor(language), language);
  const activeFilter = filter && (filter.kind==='chapter'||filter.kind==='book'||membership.active) ? filter : null;
  const questionsRef = useRef(null);
  useContentMotion(questionsRef, `${language}:${activeFilter?.kind || 'all'}:${activeFilter?.value || ''}`, '', { ready: summary?.language === language });
  const displayedEntries = !activeFilter ? entries : entries.filter(entry => activeFilter.kind === 'book' ? distribution.books.find(book => book.key === activeFilter.value)?.keys.includes(entry.key) : activeFilter.kind === 'topic' ? analysis.knowledgeDistribution.find(row=>row.sequence===activeFilter.value)?.keys.includes(entry.key) : activeFilter.kind === 'point'
    ? summary?.filterKeys?.includes(entry.key)
    : analysis.chapters.find(row => row.code === activeFilter.value)?.keys.includes(entry.key));
  const selectedEntries = selected === null ? displayedEntries : displayedEntries.filter(entry => selected.has(entry.key));
  const toggleSelection = (key) => { const next = new Set(selected === null ? displayedEntries.map(e => e.key) : selected); if (next.has(key)) next.delete(key); else next.add(key); setSelected(next); };
  const review = (kind, value) => {
    rememberFilterPosition();
    setFilter({kind, value}); setSelected(null);
    history.replaceState({}, '', `#mistakes?${kind}=${encodeURIComponent(value)}`);
  };
  const clearFilter = () => { rememberFilterPosition(); setFilter(null); setStatisticsBook('all'); setSelected(null); history.replaceState({}, '', '#mistakes'); };
  const changeStatisticsBook = key => {
    if (key === 'all') clearFilter();
    else { setStatisticsBook(key); review(key === 'unclassified' ? 'chapter' : 'book', key); }
  };
  const reviewChapter = row => { setStatisticsBook(statisticsBookFor({kind:'chapter',value:row.code}, language)); review('chapter', row.code); };
  const exportPdf = async (mode) => {
    if (!selectedEntries.length || exporting) return;
    setExporting(true); setExportError("");
    try {
      await openMistakePrint(selectedEntries, { language, mode, knowledgePoints: pointsByLanguage[language] });
    } catch (error) {
      setExportError(error.message || ("暂时未能建立 PDF，请稍后再试。"));
    } finally { setExporting(false); }
  };

  if (summary?.language !== language && !deleteKeys) return <div className="mistakes-view"><h1>{en ? 'Mistakes' : '错题库'}</h1>{loadError ? <p role="alert">{loadError}<Button onClick={() => setLoadVersion(v => v + 1)}>{en ? 'Retry' : '重试'}</Button></p> : <p role="status">{en ? 'Loading…' : '正在加载…'}</p>}</div>;
  return (
    <div ref={contentRef} className="mistakes-view page-enter" style={{ minHeight: filterMinimumHeight.current || undefined, overflowAnchor: 'none' }}>
      <div className="view-heading mistakes-heading"><div><h1>{"错题库"}</h1></div></div>
      <div data-tour="mistake-tabs" className="mistake-tabs"><Button data-tour="mistake-active-tab" variant={view==='active'?'default':'outline'} onClick={()=>setView('active')}>错题库</Button><Button data-tour="mistake-trash-tab" variant={view==='trash'?'default':'outline'} onClick={()=>setView('trash')}>回收站</Button></div>
      {view==='trash' ? <MistakeTrash onAction={manageTrash} openPaper={openPaper}/> : <>
      {!!entries.length && <section data-tour="mistake-export" className="export-controls"><div className="export-title"><div><h2>{"选择错题本版本"}</h2></div><span>{selectedEntries.length} / {displayedEntries.length} {"题已选"}</span></div><div className="export-mode"><strong>{"01 · 先独立练习"}</strong><Button disabled={exporting || !selectedEntries.length} onClick={() => exportPdf("questions")}>{exporting ? <LoaderCircle className="spin"/> : <Download/>}{en?'Questions':'原题版'}</Button></div><div className="export-mode"><strong>{"02 · 再核对思路"}</strong><Button disabled={exporting || !selectedEntries.length} onClick={() => exportPdf("detailed")}><Download/>{en?'Solutions':'详解版'}</Button></div></section>}
      {exportError && <p className="export-error" role="alert">{exportError}</p>}
      {!!entries.length && <section className="mistake-kpis">
        <Card><span className="kpi-icon rose"><CircleAlert /></span><div><strong>{entries.length}</strong><small>{"道错题"}</small></div></Card>
        <Card><span className="kpi-icon blue"><BookOpen /></span><div><strong>{membership.active ? analysis.pointCount : 0}</strong><small>{"个相关知识点"}</small></div></Card>
        <Card><span className="kpi-icon amber"><BarChart3 /></span><div><strong>{chapters[0]?.[0] || "—"}</strong><small>{"错题最多的章节"}</small></div></Card>
      </section>}

      {!entries.length ? <Card data-tour="mistake-empty" className="mistake-empty"><span><Star /></span><h2>{"错题库还是空的"}</h2><Button onClick={browsePapers}>{"开始练习"}<ArrowRight /></Button></Card>
      : <div className="mistake-dashboard">
        <section data-tour="mistake-list" ref={questionsRef} className="mistake-question-panel" id="mistake-question-list" tabIndex={-1}><div className="panel-title"><div><h2>{activeFilter ? (en ? "Review these questions" : "复习这组错题") : (en ? "Questions to review" : "待复习错题")}</h2></div><span>{displayedEntries.length}</span></div><div className="selection-toolbar"><label><input type="checkbox" aria-label={"选取全部题目"} checked={displayedEntries.length > 0 && selectedEntries.length === displayedEntries.length} disabled={!displayedEntries.length} onChange={(e) => setSelected(e.target.checked ? null : new Set())}/>{"全选"}</label><Button variant="danger" disabled={saving || deleting} onClick={() => { setDeleteError(''); setDeleteKeys(Object.keys(mistakes)); }}><Trash2 aria-hidden="true"/>{en ? 'Delete all' : '全部删除'}</Button></div><div className="mistake-list">{displayedEntries.map((entry) => <Card key={entry.key} data-mistake={entry.key} className="mistake-row"><input className="mistake-select" type="checkbox" aria-label={`${"选取"} ${questionLabelFromKey(entry.key)}`} checked={selected === null || selected.has(entry.key)} onChange={() => toggleSelection(entry.key)}/><div className="mistake-row-copy"><p>{questionLabelFromKey(entry.key)}</p><strong>{entry.paper.title} · {entry.question.label}</strong><small>{entry.chapter || ("历届试题")}</small><div>{sortKnowledge(entry.network.links,language).slice(0, 3).map((link) => <span key={`${entry.key}-${link.sequence}`}>{knowledgeNumber(link.sequence, language)}</span>)}</div></div><div className="mistake-row-actions"><Button variant="outline" disabled={saving} onClick={()=>setProgress([entry.key],"mastered")}>标为已掌握</Button><Button data-tour={entry.key==='ex-101-1'?'tour-mistake-open':undefined} variant="outline" onClick={() => openPaper(entry.key)}>{"打开"}<ArrowRight /></Button><Button variant="danger" size="icon" onClick={() => setMistake(entry.key, false)} aria-label="移入回收站" title="移入回收站"><Trash2 /></Button></div></Card>)}</div>{!displayedEntries.length && <div className="mistake-review-complete"><p>{en ? "No questions left in this group." : "这组已没有待复习错题。"}</p><Button variant="outline" onClick={clearFilter}>{en ? "Review other questions" : "继续复习其他错题"}</Button></div>}</section>
        <aside data-tour="mistake-analysis" className="mistake-analysis"><Card className="analysis-card mistake-review-card">
          <section className="mistake-distribution"><h3>{en ? 'Mistake statistics' : '错题统计'}</h3>{membership.active ? <MistakeStatistics {...distribution} bookKey={statisticsBook} onBookChange={changeStatisticsBook} language={language} onSelect={reviewChapter}/> : <MemberNotice>{en?'Members only · Mistake statistics':'会员专享 · 错题统计'}</MemberNotice>}</section>
        </Card></aside>
      </div>}
      </>}
      {deleteKeys && <div className="trash-confirm-backdrop"><section ref={deleteDialog} tabIndex={-1} className="trash-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-all-mistakes-title">
        <h2 id="delete-all-mistakes-title">{en ? `Delete all ${deleteKeys.length} mistakes?` : `删除全部 ${deleteKeys.length} 道错题？`}</h2>
        <p>{en ? 'All mistakes will move to Trash and can be restored.' : '全部错题将移入回收站，可恢复。'}</p>
        {deleteError && <p className="account-error" role="alert">{deleteError}</p>}
        <div className="selection-toolbar"><Button variant="outline" disabled={deleting || saving} onClick={closeDeleteDialog}>{en ? 'Cancel' : '取消'}</Button><Button variant="danger" disabled={deleting || saving} onClick={deleteAll}>{deleting ? (en ? 'Deleting…' : '正在删除…') : (en ? 'Confirm deletion' : '确认删除')}</Button></div>
      </section></div>}
    </div>
  );
}
