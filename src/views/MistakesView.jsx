import { MistakeStatistics } from '../components/MistakeStatistics';
import { analyzeMistakes } from '../lib/mistake-analysis';
import { ChapterPie } from '../components/ChapterPie';
import { loadExerciseIndex, exerciseMistakeEntries } from '../lib/textbook-exercises';
import { MistakeTrash } from '../components/MistakeTrash';
import { useMembership, MemberNotice } from '../components/Membership';
import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, BookOpen, CircleAlert, Download, LoaderCircle, Star, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { entriesByLanguage, knowledgeNumber, knowledgeTitle, chapterLabel, pointsByLanguage, questionLabelFromKey } from "../lib/data";
import { openMistakePrint, compareMistakePrintEntries } from "../lib/study-content";

function readReviewFilter() {
  const params = new URLSearchParams(location.hash.split('?')[1]);
  const point = Number(params.get('point'));
  if (Number.isInteger(point) && point > 0) return {kind:'point',value:point};
  const chapter = params.get('chapter');
  return chapter && /^(?:[A-Za-z0-9.]+|unclassified)$/.test(chapter) ? {kind:'chapter',value:chapter} : null;
}

export function MistakesView({ setProgress, saving, language, mistakes, setMistake, openPaper, browsePapers, manageTrash, openKnowledge }) {
  const en = language === 'eng';
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
  const exerciseEntries = exerciseData?.language === language ? exerciseMistakeEntries(exerciseData.data, pointsByLanguage[language], language) : [];
  const map = new Map([...entriesByLanguage[language], ...exerciseEntries].map(entry => [entry.key, entry]));
  const entries = Object.keys(mistakes).filter(key => map.has(key)).map(key => ({...map.get(key), markedAt: mistakes[key].markedAt, sortChapter: mistakes[key].chapterCode, primaryChapterCode: mistakes[key].primaryChapterCode})).sort(compareMistakePrintEntries(pointsByLanguage[language]));
  const analysis = analyzeMistakes(entries, pointsByLanguage[language], language);
  const chapters = analysis.chapters.map(row => [row.name, row.keys.length]);
  const activeFilter = filter?.kind === 'point' && !membership.active ? null : filter;
  const filterLabel = !activeFilter ? '' : activeFilter.kind === 'point' ? knowledgeTitle(activeFilter.value, language) : activeFilter.value === 'unclassified' ? (en ? 'Unclassified' : '未分类') : chapterLabel(activeFilter.value, language);
  const displayedEntries = !activeFilter ? entries : entries.filter(entry => activeFilter.kind === 'point'
    ? entry.network.links?.some(link => Number(link.sequence) === activeFilter.value)
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
      <div className="view-heading mistakes-heading"><div><h1>{"错题库"}</h1></div><div className="mistake-heading-actions"><Button onClick={browsePapers}>{"浏览题库"} <ArrowRight /></Button></div></div>
      <div className="mistake-tabs"><Button variant={view==='active'?'default':'outline'} onClick={()=>setView('active')}>错题库</Button><Button variant={view==='trash'?'default':'outline'} onClick={()=>setView('trash')}>回收站</Button></div>
      {view==='trash' ? <MistakeTrash onAction={manageTrash} openPaper={openPaper}/> : <>
      {!!entries.length && <section className="export-controls"><div className="export-title"><div><h2>{"选择错题本版本"}</h2></div><span>{selectedEntries.length} / {displayedEntries.length} {"题已选"}</span></div><div className="export-mode"><strong>{"01 · 先独立练习"}</strong><Button variant="outline" disabled={exporting || !selectedEntries.length} onClick={() => exportPdf("questions")}>{exporting ? <LoaderCircle className="spin"/> : <Download/>}{"打印原题版"}</Button></div><div className="export-mode"><strong>{"02 · 再核对思路"}</strong><Button disabled={exporting || !selectedEntries.length} onClick={() => exportPdf("detailed")}><Download/>{"打印详解版"}</Button></div></section>}
      {exportError && <p className="export-error" role="alert">{exportError}</p>}
      {!!entries.length && <section className="mistake-kpis">
        <Card><span className="kpi-icon rose"><CircleAlert /></span><div><strong>{entries.length}</strong><small>{"道错题"}</small></div></Card>
        <Card><span className="kpi-icon blue"><BookOpen /></span><div><strong>{membership.active ? analysis.pointCount : '—'}</strong><small>{"个相关知识点"}</small></div></Card>
        <Card><span className="kpi-icon amber"><BarChart3 /></span><div><strong>{chapters[0]?.[0] || "—"}</strong><small>{"收藏题目最多的章节"}</small></div></Card>
      </section>}

      {!entries.length ? <Card className="mistake-empty"><span><Star /></span><h2>{"错题库还是空的"}</h2><Button onClick={browsePapers}>{"开始练习"}<ArrowRight /></Button></Card>
      : <div className="mistake-dashboard">
        <section className="mistake-question-panel" id="mistake-question-list" tabIndex={-1}><div className="panel-title"><div><h2>{activeFilter ? (en ? "Review these questions" : "复习这组错题") : (en ? "Questions to review" : "待复习错题")}</h2></div><span>{displayedEntries.length}</span></div>{activeFilter && <div className="mistake-review-filter"><span>{filterLabel}</span><button onClick={clearFilter}>{en ? "Show all mistakes" : "查看全部错题"}</button></div>}<div className="selection-toolbar"><label><input type="checkbox" aria-label={"选取全部题目"} checked={displayedEntries.length > 0 && selectedEntries.length === displayedEntries.length} disabled={!displayedEntries.length} onChange={(e) => setSelected(e.target.checked ? null : new Set())}/>{"全选"}</label></div><div className="mistake-list">{displayedEntries.map((entry) => <Card key={entry.key} data-mistake={entry.key} className="mistake-row"><input className="mistake-select" type="checkbox" aria-label={`${"选取"} ${questionLabelFromKey(entry.key)}`} checked={selected === null || selected.has(entry.key)} onChange={() => toggleSelection(entry.key)}/><div className="mistake-row-copy"><p>{questionLabelFromKey(entry.key)}</p><strong>{entry.paper.title} · {entry.question.label}</strong><small>{entry.chapter || ("历届试题")}</small><div>{entry.network.links?.slice(0, 3).map((link) => <span key={`${entry.key}-${link.sequence}`}>{knowledgeNumber(link.sequence, language)}</span>)}</div></div><div className="mistake-row-actions"><Button variant="outline" disabled={saving} onClick={()=>setProgress([entry.key],"mastered")}>标为已掌握</Button><Button variant="outline" onClick={() => openPaper(entry.key)}>{"打开"}<ArrowRight /></Button><Button variant="danger" size="icon" onClick={() => setMistake(entry.key, false)} aria-label="移入回收站" title="移入回收站"><Trash2 /></Button></div></Card>)}</div>{!displayedEntries.length && <div className="mistake-review-complete"><p>{en ? "No questions left in this group." : "这组已没有待复习错题。"}</p><Button variant="outline" onClick={clearFilter}>{en ? "Review other questions" : "继续复习其他错题"}</Button></div>}</section>
        <aside className="mistake-analysis"><Card className="analysis-card mistake-review-card">
          <div className="panel-title"><h2>{en ? 'Suggested review' : '建议先复习'}</h2></div>
          {membership.active ? <>
            <div className="mistake-recommendations">{analysis.recommendations.map(item => <section key={item.sequence} data-review-point={item.sequence}>
              <h3>{knowledgeTitle(item.sequence, language)}</h3>
              <div><Button size="sm" variant="outline" onClick={() => openKnowledge(item.sequence)}>{en ? 'Knowledge card' : '查看知识卡'}</Button><Button size="sm" onClick={() => review('point', item.sequence)}>{en ? 'Retry questions' : '重做错题'}</Button></div>
            </section>)}</div>
            {!analysis.recommendations.length && <p className="review-guidance">{en ? 'No linked knowledge points yet. Start with the questions on the left.' : '这些错题暂无知识点关联，可先重做左侧题目。'}</p>}
          </> : <MemberNotice>{en ? 'Members · Knowledge cards and targeted review' : '会员专享 · 知识卡关联与针对性复习'}</MemberNotice>}
          <section className="mistake-distribution"><h3>{en ? 'Chapter overview' : '章节分布概览'}</h3><ChapterPie chapters={chapters} language={language} onDetails={() => setStatisticsOpen(true)}/></section>
        </Card></aside>
      </div>}
      </>}
      <MistakeStatistics open={statisticsOpen} onClose={() => setStatisticsOpen(false)} chapters={analysis.chapters} language={language} onSelect={row => review('chapter', row.code)}/>
    </div>
  );
}
