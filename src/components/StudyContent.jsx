import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';

// The source HTML stays intact; only image interaction is shared across readers.
export function StudyContent({html='',type='question',language='chn'}) {
  const en=language==='eng', root=useRef(null), dialog=useRef(null), trigger=useRef(null);
  const [zoom,setZoom]=useState(null),[scale,setScale]=useState(1);
  // Reviewed source pages include an unrelated MC answer strip above the structured question.
  const cropFor=src=>{
    if(type!=='official')return 0;
    const offsets={'8e694fa2dbd111118b910291.jpg':288/1224,'9d65460a41c4de26d1fede0e.jpg':204/1198,'2c309c94b5630ec7f386c989.jpg':390/1224,'305a6b80dfa44070c6100df5.jpg':200/1198};
    return (Object.entries(offsets).find(([file])=>src.includes(file))?.[1]||0)*100;
  };
  const accessibleHtml=useMemo(()=>html.replace(/<img\b[^>]*>/gi,tag=>{
    const crop=cropFor(tag);
    const image=tag.replace(/\bwidth\s*:\s*([\d.]+)px/gi,'--study-image-width:$1px;width:$1px')
      .replace(/<img\s/i,`<img tabindex="0" role="button" decoding="async" aria-label="${en?'Enlarge diagram':'放大原图'}" `);
    return crop?`<span class="official-scan-window" style="--scan-top:${crop}%">${image}</span>`:image;
  }),[html,en,type]);
  useEffect(()=>{if(zoom)dialog.current?.showModal();},[zoom]);
  const open=event=>{if(event.target.tagName==='IMG'){trigger.current=event.target;setScale(1);setZoom({src:event.target.src,alt:event.target.alt,width:event.target.naturalWidth||1000,crop:cropFor(event.target.src)});}};
  return <><div ref={root} className={`study-content ${type}-content`} onClick={open} onKeyDown={e=>{if(e.target.tagName==='IMG'&&['Enter',' '].includes(e.key)){e.preventDefault();open(e);}}} dangerouslySetInnerHTML={{__html:accessibleHtml}}/>
    {zoom&&<dialog className="study-image-dialog" ref={dialog} aria-label={en?'Image zoom':'图片缩放'} onClose={()=>{setZoom(null);trigger.current?.focus({preventScroll:true});}} onClick={e=>{if(e.target===e.currentTarget)dialog.current.close();}}>
      <div className="study-zoom-toolbar">
        <Button variant="outline" aria-label={en?'Zoom out':'缩小'} disabled={scale<=.25} onClick={()=>setScale(v=>Math.max(.25,v-.25))}>−</Button>
        <output aria-live="polite">{Math.round(scale*100)}%</output>
        <Button variant="outline" aria-label={en?'Zoom in':'放大'} disabled={scale>=3} onClick={()=>setScale(v=>Math.min(3,v+.25))}>＋</Button>
        <Button variant="outline" onClick={()=>setScale(Math.min(1,(dialog.current.clientWidth-34)/zoom.width))}>{en?'Fit width':'适应宽度'}</Button>
        <Button onClick={()=>dialog.current.close()}>{en?'Close':'关闭'} ×</Button>
      </div>
      <div className="study-zoom-scroll"><div className={zoom.crop?'study-zoom-canvas official-scan-window':'study-zoom-canvas'} style={{width:zoom.width*scale,'--scan-top':`${zoom.crop}%`}}><img src={zoom.src} alt={zoom.alt|| (en?'Enlarged diagram':'原图放大')}/></div></div>
    </dialog>}
  </>;
}
