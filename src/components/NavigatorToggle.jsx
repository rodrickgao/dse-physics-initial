import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { readSaved, writeSaved } from '../lib/study-state';

export function NavigatorToggle({language,controls}) {
  const [collapsed,setCollapsed]=useState(()=>readSaved('dse-question-navigator-collapsed',false)===true);
  const en=language==='eng', Icon=collapsed?PanelLeftOpen:PanelLeftClose;
  return <button className="navigator-toggle" aria-expanded={!collapsed} aria-controls={controls} onClick={()=>{setCollapsed(!collapsed);writeSaved('dse-question-navigator-collapsed',!collapsed);}}><Icon aria-hidden="true"/><span>{collapsed?(en?'Open':'打开'):(en?'Collapse':'收起')}</span></button>;
}

