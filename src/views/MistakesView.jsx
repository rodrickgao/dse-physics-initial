import { MistakeTrash } from '../components/MistakeTrash';
import { useMembership, MemberNotice } from '../components/Membership';
import { useState } from "react";
import { ArrowRight, BarChart3, BookOpen, CircleAlert, Download, FileQuestion, LoaderCircle, Star, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { entriesByLanguage, knowledgeNumber, imageUrl, pointsMap, questionLabelFromKey } from "../lib/data";
import { openMistakePrint } from "../lib/study-content";
import { mistakeCoverage } from "../lib/study-state";

export function MistakesView({ setProgress, saving, language, mistakes, setMistake, openPaper, browsePapers, manageTrash }) {
  const [view, setView] = useState('active');
  const membership = useMembership();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [spaceMm, setSpaceMm] = useState(50);
  const [selected, setSelected] = useState(null);
  const map = new Map(entriesByLanguage[language].map((entry) => [entry.key, entry]));
  const entries = Object.keys(mistakes).map((key) => map.get(key)).filter(Boolean).sort((a, b) => a.year.year - b.year.year || a.paperIndex - b.paperIndex || a.questionIndex - b.questionIndex);
  const selectedEntries = selected === null ? entries : entries.filter(entry => selected.has(entry.key));
  const toggleSelection = (key) => { const next = new Set(selected === null ? entries.map(e => e.key) : selected); if (next.has(key)) next.delete(key); else next.add(key); setSelected(next); };
  const {points: pointRows, chapters: chapterRows} = mistakeCoverage(entries, language);
  const chapters = [...chapterRows.entries()].sort((a, b) => b[1] - a[1]);
  const points = [...pointRows.entries()].sort((a, b) => b[1] - a[1]);
  const maxChapter = chapters[0]?.[1] || 1;
  const exportPdf = async (mode) => {
    if (!selectedEntries.length || exporting) return;
    setExporting(true); setExportError("");
    try {
      await openMistakePrint(selectedEntries, { language, mode, spaceMm });
    } catch (error) {
      setExportError(error.message || ("暂时未能建立 PDF，请稍后再试。"));
    } finally { setExporting(false); }
  };

  return (
    <div className="mistakes-view page-enter">
      <div className="view-heading mistakes-heading"><div><h1>{"错题库"}</h1></div><div className="mistake-heading-actions"><Button onClick={browsePapers}>{"浏览真题"} <ArrowRight /></Button></div></div>
      <div className="mistake-tabs"><Button variant={view==='active'?'default':'outline'} onClick={()=>setView('active')}>错题库</Button><Button variant={view==='trash'?'default':'outline'} onClick={()=>setView('trash')}>回收站</Button></div>
      {view==='trash' ? <MistakeTrash onAction={manageTrash} openPaper={openPaper}/> : <>
      {!!entries.length && <section className="export-controls"><div className="export-title"><div><h2>{"选择错题本版本"}</h2></div><span>{selectedEntries.length} / {entries.length} {"题已选"}</span></div><div className="export-mode"><strong>{"01 · 先独立练习"}</strong><Button variant="outline" disabled={exporting || !selectedEntries.length} onClick={() => exportPdf("questions")}>{exporting ? <LoaderCircle className="spin"/> : <Download/>}{"原题版 PDF"}</Button></div><div className="export-mode"><strong>{"02 · 再核对思路"}</strong><Button disabled={exporting || !selectedEntries.length} onClick={() => exportPdf("detailed")}><Download/>{"详解版 PDF"}</Button></div><label>{"每题作答留白 "}<select value={spaceMm} onChange={(e) => setSpaceMm(Number(e.target.value))}>{[30, 50, 80, 120].map((n) => <option key={n} value={n}>{n} mm</option>)}</select></label></section>}
      {exportError && <p className="export-error" role="alert">{exportError}</p>}
      <section className="mistake-kpis">
        <Card><span className="kpi-icon rose"><CircleAlert /></span><div><strong>{entries.length}</strong><small>{"道错题"}</small></div></Card>
        <Card><span className="kpi-icon blue"><BookOpen /></span><div><strong>{pointRows.size}</strong><small>{"个相关知识点"}</small></div></Card>
        <Card><span className="kpi-icon amber"><BarChart3 /></span><div><strong>{chapters[0]?.[0] || "—"}</strong><small>{"收藏题目最多的章节"}</small></div></Card>
      </section>

      {!entries.length ? <Card className="mistake-empty"><span><Star /></span><h2>{"错题库还是空的"}</h2><Button onClick={browsePapers}>{"开始做真题"}<ArrowRight /></Button></Card>
      : <div className="mistake-dashboard">
        <section className="mistake-question-panel"><div className="panel-title"><div><h2>{"已收藏题目"}</h2></div><span>{entries.length}</span></div><div className="selection-toolbar"><label><input type="checkbox" aria-label={"选取全部题目"} checked={selectedEntries.length === entries.length} onChange={(e) => setSelected(e.target.checked ? null : new Set())}/>{"全选"}</label></div><div className="mistake-list">{entries.map((entry) => <Card key={entry.key} className="mistake-row"><input className="mistake-select" type="checkbox" aria-label={`${"选取"} ${questionLabelFromKey(entry.key)}`} checked={selected === null || selected.has(entry.key)} onChange={() => toggleSelection(entry.key)}/><button className="mistake-thumbnail" aria-label={`${"打开"} ${questionLabelFromKey(entry.key)}`} onClick={() => openPaper(entry.key)}>{entry.question.question?.[0] ? <img src={imageUrl(entry.year.id, entry.question.question[0])} alt="" loading="lazy" /> : <FileQuestion />}</button><div className="mistake-row-copy"><p>{questionLabelFromKey(entry.key)}</p><strong>{entry.paper.title} · {entry.question.label}</strong><small>{entry.chapter || ("历届试题")}</small><div>{entry.network.links?.slice(0, 3).map((link) => <span key={`${entry.key}-${link.sequence}`}>{knowledgeNumber(link.sequence, language)}</span>)}</div></div><div className="mistake-row-actions"><Button variant="outline" disabled={saving} onClick={()=>setProgress([entry.key],"mastered")}>标为已掌握</Button><Button variant="outline" onClick={() => openPaper(entry.key)}>{"打开"}<ArrowRight /></Button><Button variant="danger" size="icon" onClick={() => setMistake(entry.key, false)} aria-label="移入回收站" title="移入回收站"><Trash2 /></Button></div></Card>)}</div></section>
        <aside className="mistake-analysis">{!membership.active && <MemberNotice/>}<Card className="analysis-card"><div className="panel-title"><div><h2>{"错题章节分布"}</h2></div></div><div className="chapter-bars">{chapters.slice(0, 7).map(([name, count]) => <div key={name}><span><b>{name}</b><strong>{count}</strong></span><i><em style={{ width: `${count / maxChapter * 100}%` }} /></i></div>)}</div></Card><Card className="analysis-card"><div className="panel-title"><div><h2>{"下一步复习"}</h2></div></div><div className="top-points">{points.slice(0, 6).map(([sequence, count]) => { const point = pointsMap[language].get(sequence); return <div key={sequence}><span><b>{knowledgeNumber(sequence, language)}</b><small>{point?.chapter}</small></span><strong>{count}</strong></div>; })}</div></Card></aside>
      </div>}
      </>}
    </div>
  );
}
