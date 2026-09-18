import { useEffect, useMemo, useRef, useState } from 'react';
import { Expand, X } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function Equation({ latex, inline = false }) {
  const html = useMemo(() => katex.renderToString(latex, {
    displayMode: !inline, throwOnError: false, trust: false, output: 'htmlAndMathml',
  }), [latex, inline]);
  return inline ? <span dangerouslySetInnerHTML={{ __html: html }} />
    : <div className="knowledge-equation" tabIndex={0} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Notation({ text }) {
  return String(text).split(/([A-Za-z\u0370-\u03ff]+_[A-Za-z0-9]+)/g).map((part, i) => {
    const match = /^([A-Za-z\u0370-\u03ff]+)_([A-Za-z0-9]+)$/.exec(part);
    return match ? <Equation key={i} inline latex={`${match[1]}_{\\mathrm{${match[2]}}}`} /> : part;
  });
}

function SourceImage({ figure, language, onOpen }) {
  return <figure className="textbook-figure">
    <button className="textbook-image-button" onClick={() => onOpen(figure)} title={'放大课本原图'}>
      <img src={figure.src} width={figure.width} height={figure.height} alt={figure.caption} loading="lazy" />
      <Expand aria-hidden="true" />
    </button>
    <figcaption><Notation text={figure.caption} /><small>{'英文课本原图'} · {figure.source} · PDF {figure.page}</small></figcaption>
  </figure>;
}

export function TextbookContent({ point, language }) {
  const [expanded, setExpanded] = useState(null);
  const dialog = useRef(null);
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
    else dialog.current?.close();
  }, [expanded]);
  return <>
    {point.formula_latex?.length ? <section className="knowledge-formulas" aria-label={'公式及符号'}>
      {point.formula_latex.map((latex, i) => <Equation key={i} latex={latex} />)}
      <p className="knowledge-notation"><Notation text={point.formula_notes} /></p>
    </section> : <div className="knowledge-content">{point.content.split('\n').filter(Boolean).map((text, i) => <p key={i}><Notation text={text} /></p>)}</div>}
    {point.figures?.map(figure => <SourceImage key={figure.id} figure={figure} language={language} onOpen={setExpanded} />)}
    <dialog ref={dialog} className="textbook-image-dialog" onCancel={() => setExpanded(null)} onClick={event => { if (event.target === event.currentTarget) setExpanded(null); }} aria-label={'课本原图'}>
      <div className="textbook-dialog-head"><span>{expanded?.source} · PDF {expanded?.page}</span><button onClick={() => setExpanded(null)} aria-label={'关闭图片'}><X /></button></div>
      {expanded && <><img src={expanded.src} alt={expanded.caption} /><p><Notation text={expanded.caption} /></p></>}
    </dialog>
  </>;
}
