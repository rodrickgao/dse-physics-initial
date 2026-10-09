import { exerciseNumber } from '../lib/exercise-numbering';
import {QdnaProfile} from '../components/QdnaProfile';
import { exampleEntries } from '../lib/textbook-examples';
import { MistakeStatistics } from '../components/MistakeStatistics';
import { ChapterPie } from '../components/ChapterPie';
import { loadExerciseIndex, exerciseMistakeEntries } from '../lib/textbook-exercises';
import { MistakeTrash } from '../components/MistakeTrash';
import { useMembership, MemberNotice } from '../components/Membership';
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BarChart3, BookOpen, CircleAlert, Download, LoaderCircle, Star, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { entriesByLanguage, sortKnowledge, knowledgeNumber, knowledgeTitle, chapterLabel, pointsByLanguage, questionLabelFromKey } from "../lib/data";
import { openMistakePrint, compareMistakePrintEntries } from "../lib/study-content";

function readReviewFilter() {
  const params = new URLSearchParams(location.hash.split('?')[1]);
  const point = Number(params.get('point'));
  if (Number.isInteger(point) && point > 0) return {kind:'point',value:point};
  const chapter = params.get('chapter');
  return chapter && /^(?:[A-Za-z0-9.]+|unclassified)$/.test(chapter) ? {kind:'chapter',value:chapter} : null;
}

export function MistakesView({ mastered, setProgress, saving, language, mistakes, setMistake, openPaper, browsePapers, manageTrash, openKnowledge }) {
  const en = language === 'eng';
  const qdnaRevision=useMemo(()=>({mastered,mistakes}),[mastered,mistakes]);
  const membership = useMembership();
  const [filter, setFilter] = useState(readReviewFilter);
  useEffect(() => {
    const restore = () => { if (location.hash.split('?')[0] === '#mistakes') { setFilter(readReviewFilter()); setSelected(null); } };
    addEventListener('popstate',restore); addEventListener('hashchange',restore);
    return () => { removeEventListener('popstate',restore); removeEventListener('hashchange',restore); };
  }, []);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const [view, setView] = useState('active');
  const [exerciseData, setExerciseData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const needsExercises = Object.keys(mistakes).some(key => key.startsWith('tb-'));
  useEffect(() => {
    let active = true; setExerciseData(null); setLoadError('');
    if (needsExercises) loadExerciseIndex(language).then(data => { if (active) setExerciseData({language, data}); }).catch(() => { if (active) setLoadError(language === 'eng' ? 'Unable to load textbook mistakes.' : '课本错题加载失败，请重试。'); });
    return () => { active = false; };
  }, [language, needsExercises, loadVersion, membership.revision]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [selected, setSelected] = useState(null);
  const exerciseEntries = Object.keys(mistakes).filter(key=>key.startsWith('tb-')).map(key=>({key,source:'textbook',exerciseChapter:key.split('-')[1],year:{year:0,id:''},paperIndex:1,questionIndex:Number(key.split('-').at(-1)),question:{label:'Q'+exerciseNumber(key),kind:'structured'},paper:{title:en?'Textbook exercises':'课本习题'},chapter:key.split('-')[1],network:{links:[]}}));
  const map = new Map([...entriesByLanguage[language], ...exerciseEntries, ...exampleEntries(pointsByLanguage[language],language)].map(entry => [entry.key, entry]));
  const [summary,setSummary]=useState(null);
  const order = new Map((summary?.orderedKeys || []).map((key,index)=>[key,index]));
  const entries = Object.keys(mistakes).filter(key => map.has(key)).map(key => ({...map.get(key), mistakeOrder: order.get(key), markedAt: mistakes[key].markedAt, sortChapter: mistakes[key].chapterCode, primaryChapterCode: mistakes[key].primaryChapterCode})).sort(compareMistakePrintEntries(pointsByLanguage[language]));
  useEffect(()=>{let live=true;setSummary(null);const params=new URLSearchParams({language});if(filter?.kind==='point'&&membership.active)params.set('point',filter.value);fetch(`/api/content/mistake-summary?${params}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(live)setSummary(data);}).catch(()=>{if(live)setLoadError(en?'Statistics unavailable. Please retry.':'统计暂时无法加载，请重试。');});return()=>{live=false;};},[language,mistakes,filter,membership.revision]);
  const analysis = summary || {chapters:[],recommendations:[],pointCount:0};
  const chapters = analysis.chapters.map(row => [row.name, row.keys.length]);
  const activeFilter = filter?.kind === 'point' && !membership.active ? null : filter;
  const filterLabel = !activeFilter ? '' : activeFilter.kind === 'point' ? knowledgeTitle(activeFilter.value, language) : activeFilter.value === 'unclassified' ? (en ? 'Unclassified' : '未分类') : chapterLabel(activeFilter.value, language);
  const displayedEntries = !activeFilter ? entries : entries.filter(entry => activeFilter.kind === 'point'
    ? summary?.filterKeys?.includes(entry.key)
    : analysis.chapters.find(row => row.code === activeFilter.value)?.keys.includes(entry.key));
  const selectedEntries = selected === null ? displayedEntries : displayedEntries.filter(entry => selected.has(entry.key));
  const toggleSelection = (key) => { const next = new Set(selected === null ? displayedEntries.map(e => e.key) : selected); if (next.has(key)) next.delete(key); else next.add(key); setSelected(next); };
  const review = (kind, value) => {
    setFilter({kind, value}); setSelected(null);
    history.replaceState({}, '', `#mistakes?${kind}=${encodeURIComponent(value)}`);
    requestAnimationFrame(() => { const panel = document.getElementById('mistake-question-list'); panel?.focus({preventScroll:true}); panel?.scrollIntoView({block:'start',behavior:'instant'}); });
  };
  const clearFilter = () => { setFilter(null); setSelected(null); history.replaceState({}, '', '#mistakes'); };
  const exportPdf = async (mode) => {
    if (!selectedEntries.length || exporting) return;
    setExporting(true); setExportError("");
    try {
      await openMistakePrint(selectedEntries, { language, mode, knowledgePoints: pointsByLanguage[language] });
    } catch (error) {
      setExportError(error.message || ("暂时未能建立 PDF，请稍后再试。"));
    } finally { setExporting(false); }
  };

  if (needsExercises && exerciseData?.language !== language) return <div className="mistakes-view"><h1>{language === 'eng' ? 'Mistakes' : '错题库'}</h1>{loadError ? <p role="alert">{loadError}<Button onClick={() => setLoadVersion(v => v + 1)}>{language === 'eng' ? 'Retry' : '重试'}</Button></p> : <p role="status">{language === 'eng' ? 'Loading…' : '正在加载…'}</p>}</div>;
  return (
    <div className="mistakes-view page-enter">
      <div className="view-heading mistakes-heading"><div><h1>{"错题库"}</h1></div></div>
      <div data-tour="mistake-tabs" className="mistake-tabs"><Button data-tour="mistake-active-tab" variant={view==='active'?'default':'outline'} onClick={()=>setView('active')}>错题库</Button><Button data-tour="mistake-trash-tab" variant={view==='trash'?'default':'outline'} onClick={()=>setView('trash')}>回收站</Button></div>
      {view==='trash' ? <MistakeTrash onAction={manageTrash} openPaper={openPaper}/> : <>
      {!!entries.length && <section data-tour="mistake-export" className="export-controls"><div className="export-title"><div><h2>{"选择错题本版本"}</h2></div><span>{selectedEntries.length} / {displayedEntries.length} {"题已选"}</span></div><div className="export-mode"><strong>{"01 · 先独立练习"}</strong><Button disabled={exporting || !selectedEntries.length} onClick={() => exportPdf("questions")}>{exporting ? <LoaderCircle className="spin"/> : <Download/>}{en?'Questions':'原题版'}</Button></div><div className="export-mode"><strong>{"02 · 再核对思路"}</strong><Button disabled={exporting || !selectedEntries.length} onClick={() => exportPdf("detailed")}><Download/>{en?'Solutions':'详解版'}</Button></div></section>}
      {exportError && <p className="export-error" role="alert">{exportError}</p>}
      <QdnaProfile language={language} revision={qdnaRevision} openQuestion={openPaper}/>
      {!!entries.length && <section className="mistake-kpis">
        <Card><span className="kpi-icon rose"><CircleAlert /></span><div><strong>{entries.length}</strong><small>{"道错题"}</small></div></Card>
        <Card><span className="kpi-icon blue"><BookOpen /></span><div><strong>{membership.active ? analysis.pointCount : '—'}</strong><small>{"个相关知识点"}</small></div></Card>
        <Card><span className="kpi-icon amber"><BarChart3 /></span><div><strong>{chapters[0]?.[0] || "—"}</strong><small>{"错题最多的章节"}</small></div></Card>
      </section>}

      {!entries.length ? <Card data-tour="mistake-empty" className="mistake-empty"><span><Star /></span><h2>{"错题库还是空的"}</h2><Button onClick={browsePapers}>{"开始练习"}<ArrowRight /></Button></Card>
      : <div className="mistake-dashboard">
        <section data-tour="mistake-list" className="mistake-question-panel" id="mistake-question-list" tabIndex={-1}><div className="panel-title"><div><h2>{activeFilter ? (en ? "Review these questions" : "复习这组错题") : (en ? "Questions to review" : "待复习错题")}</h2></div><span>{displayedEntries.length}</span></div>{activeFilter && <div className="mistake-review-filter"><span>{filterLabel}</span><button onClick={clearFilter}>{en ? "Show all mistakes" : "查看全部错题"}</button></div>}<div className="selection-toolbar"><label><input type="checkbox" aria-label={"选取全部题目"} checked={displayedEntries.length > 0 && selectedEntries.length === displayedEntries.length} disabled={!displayedEntries.length} onChange={(e) => setSelected(e.target.checked ? null : new Set())}/>{"全选"}</label></div><div className="mistake-list">{displayedEntries.map((entry) => <Card key={entry.key} data-mistake={entry.key} className="mistake-row"><input className="mistake-select" type="checkbox" aria-label={`${"选取"} ${questionLabelFromKey(entry.key)}`} checked={selected === null || selected.has(entry.key)} onChange={() => toggleSelection(entry.key)}/><div className="mistake-row-copy"><p>{questionLabelFromKey(entry.key)}</p><strong>{entry.paper.title} · {entry.question.label}</strong><small>{entry.chapter || ("历届试题")}</small><div>{sortKnowledge(entry.network.links,language).slice(0, 3).map((link) => <span key={`${entry.key}-${link.sequence}`}>{knowledgeNumber(link.sequence, language)}</span>)}</div></div><div className="mistake-row-actions"><Button variant="outline" disabled={saving} onClick={()=>setProgress([entry.key],"mastered")}>标为已掌握</Button><Button data-tour={entry.key==='ex-101-1'?'tour-mistake-open':undefined} variant="outline" onClick={() => openPaper(entry.key)}>{"打开"}<ArrowRight /></Button><Button variant="danger" size="icon" onClick={() => setMistake(entry.key, false)} aria-label="移入回收站" title="移入回收站"><Trash2 /></Button></div></Card>)}</div>{!displayedEntries.length && <div className="mistake-review-complete"><p>{en ? "No questions left in this group." : "这组已没有待复习错题。"}</p><Button variant="outline" onClick={clearFilter}>{en ? "Review other questions" : "继续复习其他错题"}</Button></div>}</section>
        <aside data-tour="mistake-analysis" className="mistake-analysis"><Card className="analysis-card mistake-review-card">
          <section className="mistake-distribution"><h3>{en ? 'Chapter overview' : '章节分布概览'}</h3><ChapterPie chapters={chapters} language={language} onDetails={() => setStatisticsOpen(true)}/></section>
        </Card></aside>
      </div>}
      </>}
      <MistakeStatistics open={statisticsOpen} onClose={() => setStatisticsOpen(false)} chapters={analysis.chapters} language={language} onSelect={row => review('chapter', row.code)}/>
    </div>
  );
}
