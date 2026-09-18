import { useEffect, useMemo, useRef, useState } from 'react';
import { Expand, X } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { cardFigures, cardSections } from '../lib/shared-figure-cards';

function Equation({ latex, inline = false }) {
  const html = useMemo(() => katex.renderToString(latex, {
    displayMode: !inline, throwOnError: false, trust: false, output: 'htmlAndMathml',
  }), [latex, inline]);
  return inline ? <span className="knowledge-inline-equation" dangerouslySetInnerHTML={{ __html: html }} />
    : <div className="knowledge-equation" tabIndex={0} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Notation({ text }) {
  return String(text || '').split(/(\\\([\s\S]*?\\\)|[A-Za-z\u0370-\u03ff]+_[A-Za-z0-9]+)/g).map((part, i) => {
    if (part.startsWith('\\(') && part.endsWith('\\)')) return <Equation key={i} inline latex={part.slice(2, -2)} />;
    const match = /^([A-Za-z\u0370-\u03ff]+)_([A-Za-z0-9]+)$/.exec(part);
    return match ? <Equation key={i} inline latex={`${match[1]}_{\\mathrm{${match[2]}}}`} /> : part;
  });
}

function SourceImage({ figure, language, onOpen }) {
  return <figure className="textbook-figure">
    <button className="textbook-image-button" onClick={() => onOpen(figure)} title={language === 'eng' ? 'Enlarge textbook figure' : '放大课本原图'}>
      <img src={figure.src} width={figure.width} height={figure.height} alt={figure.caption} loading="lazy" />
      <Expand aria-hidden="true" />
    </button>
    <figcaption><Notation text={figure.caption} /></figcaption>
  </figure>;
}


function SectionContent({ section }) {
 const point=section.point;
 const equations=[...new Set(section.members.flatMap(p=>p.formula_latex||[]))];
 const notes=[...new Set(section.members.map(p=>p.card_formula_notes||p.formula_notes).filter(Boolean))];
 return <>
  <div className="knowledge-content knowledge-summary"><p><Notation text={point.card_summary || point.content} /></p></div>
  {!!equations.length && <section className="knowledge-formulas" aria-label={point.card_summary_language === "eng" ? "Equations and symbols" : "公式及符号"}>
   {equations.map(latex=><Equation key={latex} latex={latex}/>)}
   {notes.map(text=><p key={text} className="knowledge-notation"><Notation text={text}/></p>)}
  </section>}
 </>;
}

export function TextbookSources({ point, language }) {
 const en=language === "eng";
 const members=point.members||[point];
 const figures=cardFigures(point);
 const sources=[...new Map(members.flatMap(p=>p.source_excerpts?.length?p.source_excerpts:[{source:p.source,code:p.code,page:p.page}]).map(s=>[JSON.stringify(s),s])).values()];
 return <footer className="textbook-source-footer">
  <details className="textbook-explanation textbook-source-details">
   <summary>{en ? "Textbook sources" : "课本来源"}</summary>
   {figures.map((f,i)=><p key={f.src} className="textbook-image-source">{figures.length>1?(en?'Figure ':'图 ')+(i+1)+' · ':''}{f.language === 'chn' ? (en ? "Original Chinese textbook figure" : "中文课本原图") : (en ? "Original English textbook figure" : "英文课本原图")} · {f.source} · PDF {f.page}</p>)}
   {sources.map((source,i)=><div key={i}>{source.text&&<blockquote lang="en">{source.text}</blockquote>}<p className="textbook-citation">{source.source || source.code} · PDF {source.page}{source.printed_page ? (en?' · Printed page ':' · 书页 ')+source.printed_page:''}</p></div>)}
   {members.flatMap(p=>p.textbook_supplements||[]).map(supplement=><div key={supplement.id}>
    {supplement.source_excerpts.map((source,i)=><div key={i}><blockquote lang="en">{source.text}</blockquote><p className="textbook-citation">{source.code} · PDF {source.page}</p></div>)}
    {(en ? supplement.explanation_en : supplement.explanation_zh)&&<p>{en ? supplement.explanation_en : supplement.explanation_zh}</p>}
   </div>)}
  </details>
 </footer>;
}

export function TextbookContent({ point, language }) {
 const [expanded,setExpanded]=useState(null);
 const dialog=useRef(null);
 useEffect(()=>{if(expanded)dialog.current?.showModal();else dialog.current?.close();},[expanded]);
 const sections=cardSections(point),grouped=sections.length>1;
 return <>
  {sections.map((section,i)=><section className={grouped?'knowledge-subpoint':undefined} key={section.point.sequence}>
   {section.members.filter(m=>m.sequence!==point.sequence).map(m=><span id={'point-'+m.sequence} key={m.sequence} className="knowledge-subpoint-anchor"/>)}
   {grouped&&<h4 className="knowledge-subpoint-title"><span>{section.members.map(m=>m.number).join(' · ')}</span>{section.point.card_title||section.point.title||section.point.chapter}</h4>}
   <SectionContent section={section}/>
  </section>)}
  {cardFigures(point).map((figure,i)=><SourceImage key={figure.src} figure={{...figure,caption:(cardFigures(point).length>1?(language === 'eng'?'Figure ':'图 ')+(i+1)+' · ':'')+figure.caption}} language={language} onOpen={setExpanded}/>)}
  <dialog ref={dialog} className="textbook-image-dialog" onCancel={()=>setExpanded(null)} onClick={event=>{if(event.target===event.currentTarget)setExpanded(null);}} aria-label={language === "eng" ? "Textbook figure" : "课本原图"}>
   <div className="textbook-dialog-head"><span>{expanded?.source} · PDF {expanded?.page}</span><button onClick={()=>setExpanded(null)} aria-label={language === "eng" ? "Close image" : "关闭图片"}><X/></button></div>
   {expanded&&<><img src={expanded.src} alt={expanded.caption}/><p><Notation text={expanded.caption}/></p></>}
  </dialog>
 </>;
}
