import { useEffect, useRef, useState } from 'react';
import { Home, FileQuestion, BookOpen, CircleAlert, MoreHorizontal, Crown, Timer, MessageCircle } from 'lucide-react';
import { useMembership } from './Membership';
export function MobileNavigation({page,language,navigate}) {
  const [open,setOpen]=useState(false),root=useRef(null),membership=useMembership();const en=language==='eng';
  useEffect(()=>{setOpen(false);},[page]);
  useEffect(()=>{if(!open)return;const dismiss=e=>{if(e.type==='keydown'?e.key==='Escape':!root.current?.contains(e.target))setOpen(false);};document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',dismiss);return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',dismiss);};},[open]);
  const entries=[['home',en?'Home':'主页',Home],['bank',en?'Questions':'题库',FileQuestion],['textbook',en?'Knowledge':'知识库',BookOpen],['mistakes',en?'Mistakes':'错题库',CircleAlert]];
  const more=[['membership',membership.active?(en?'My membership':'我的会员'):(en?'Membership':'开通会员'),Crown],['ask',en?'Ask a teacher':'问老师',MessageCircle],['focus',en?'Focus timer':'番茄钟',Timer]];
  return <nav ref={root} className="mobile-nav compact-mobile-nav" aria-label={en?'Main navigation':'主导航'}>{entries.map(([id,label,Icon])=><button key={id} aria-current={page===id?'page':undefined} className={page===id?'active':''} onClick={()=>navigate(id)}><Icon/><span>{label}</span></button>)}<button aria-expanded={open} aria-controls="mobile-more-menu" className={more.some(([id])=>id===page)?'active':''} onClick={()=>setOpen(v=>!v)}><MoreHorizontal/><span>{en?'More':'更多'}</span></button>{open&&<div id="mobile-more-menu" className="mobile-more-menu">{more.map(([id,label,Icon])=><button key={id} onClick={()=>{setOpen(false);navigate(id);}}><Icon/><span>{label}</span></button>)}</div>}</nav>;
}
