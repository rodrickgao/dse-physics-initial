import { Clock3 } from 'lucide-react';
import { useState } from 'react';

export function FocusCountdown({ timer, language, onOpen, mobile = false }) {
  const [collapsed,setCollapsed]=useState(true);
  if (!timer) return null;
  const en = language === 'eng';
  const progress = Math.max(0, Math.min(1, timer.remaining / (timer.session.minutes * 60000)));
  if(collapsed)return <div className={`timer-compact${mobile?' timer-compact-mobile':''}`}><button className="timer-open" onClick={onOpen} aria-label={en?'Open focus timer':'打开专注计时'}><Clock3 aria-hidden="true"/><span>{timer.time}</span></button><button className="timer-expand" onClick={()=>setCollapsed(false)} aria-label={en?'Expand timer':'展开计时器'}>＋</button></div>;
  return <div className={mobile?'timer-expanded-mobile':'timer-expanded'}><button className="timer-collapse" onClick={()=>setCollapsed(true)}>{en?'Collapse timer':'收起计时器'}</button><button type="button" className={`focus-countdown${mobile ? ' focus-countdown-mobile' : ''}`} onClick={onOpen} title={en ? 'Open timer settings' : '打开时长设置'} aria-label={en ? `Focus timer ${timer.time}. Open timer settings` : `番茄钟 ${timer.time}，打开时长设置`}>
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="focus-countdown-track" cx="60" cy="60" r="54" /><circle className="focus-countdown-progress" cx="60" cy="60" r="54" pathLength="100" strokeDasharray="100" strokeDashoffset={100 * (1 - progress)} /></svg>
    <strong className="focus-countdown-time">{timer.time}</strong>
  </button></div>;
}
