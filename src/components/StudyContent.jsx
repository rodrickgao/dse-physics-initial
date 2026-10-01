import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';

// The source HTML stays intact; only image interaction is shared across readers.
export function StudyContent({html='',type='question',language='chn'}) {
  const en=language==='eng', root=useRef(null), dialog=useRef(null), trigger=useRef(null);
  const [zoom,setZoom]=useState(null);
  const accessibleHtml=useMemo(()=>html.replace(/<img\b[^>]*>/gi,tag=>tag
    .replace(/\bwidth\s*:\s*([\d.]+)px/gi,'--study-image-width:$1px;width:$1px')
    .replace(/<img\s/i,`<img tabindex="0" role="button" decoding="async" aria-label="${en?'Enlarge diagram':'放大原图'}" `)),[html,en]);
  useEffect(()=>{if(zoom)dialog.current?.showModal();},[zoom]);
  const open=event=>{if(event.target.tagName==='IMG'){trigger.current=event.target;setZoom({src:event.target.src,alt:event.target.alt});}};
  return <><div ref={root} className={`study-content ${type}-content`} onClick={open} onKeyDown={e=>{if(e.target.tagName==='IMG'&&['Enter',' '].includes(e.key)){e.preventDefault();open(e);}}} dangerouslySetInnerHTML={{__html:accessibleHtml}}/>
    {zoom&&<dialog className="study-image-dialog" ref={dialog} onClose={()=>{setZoom(null);trigger.current?.focus({preventScroll:true});}} onClick={e=>{if(e.target===e.currentTarget)dialog.current.close();}}><form method="dialog"><Button>{en?'Close':'关闭'} ×</Button></form><div><img src={zoom.src} alt={zoom.alt|| (en?'Enlarged diagram':'原图放大')}/></div></dialog>}
  </>;
}
