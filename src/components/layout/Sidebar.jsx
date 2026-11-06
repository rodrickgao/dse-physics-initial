import { MEMBERSHIP_ENABLED } from '../../lib/access-policy';
import { useLayoutEffect, useRef } from 'react';
import { BookOpen, Clock3, PanelLeftClose, PanelLeftOpen, CircleAlert, FileQuestion, Home, Crown, Moon, Sun } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';
import { FocusCountdown } from '../FocusCountdown';
import { useMembership } from '../Membership';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

const NAVIGATION = [
  { id: "home", zh: "主页", en: "Home", icon: Home },
  { id: "bank", zh: "题库", en: "Question bank", icon: FileQuestion },
  { id: "textbook", zh: "课本知识库", en: "Knowledge", icon: BookOpen },
  { id: "mistakes", zh: "错题库", en: "Mistakes", icon: CircleAlert },
  { id: "membership", zh: "开通会员", en: "Membership", icon: Crown },
  { id: "ask", zh: "问老师", en: "Ask a teacher", icon: BookOpen },
];

export function Sidebar({ page, navigate, dark, toggleDark, language, mistakeCount, focusTimer, collapsed, toggleCollapsed }) {
  const navigation = useRef(null);
  useLayoutEffect(() => {
    const nav = navigation.current;
    const indicator = nav?.querySelector('.active-nav-trail');
    if (!indicator) return;
    const measure = () => {
      const current = nav.querySelector('[aria-current="page"]');
      indicator.style.opacity = current ? '1' : '0';
      if (!current) return;
      indicator.style.height = `${Math.max(16, current.offsetHeight - 22)}px`;
      indicator.style.transform = `translateY(${current.offsetTop + 11}px)`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [page, collapsed, language]);
  const membership=useMembership(),english=language==='eng';
  const toggleLabel=collapsed?(english?'Expand navigation':'展开目录'):(english?'Collapse navigation':'收起目录');
  const themeLabel=dark?(english?'Light mode':'浅色模式'):(english?'Dark mode':'深色模式');
  return <aside className="sidebar" aria-label={english?'Main navigation':'主目录'}>
    <div className="sidebar-heading"><button className="brand" aria-label="DSE Physics" title="DSE Physics" onClick={() => navigate("home")}><BrandLogo language={language}/></button>
    <button className="sidebar-toggle" onClick={toggleCollapsed} aria-expanded={!collapsed} aria-controls="main-navigation" aria-label={toggleLabel} title={toggleLabel}>{collapsed?<PanelLeftOpen/>:<PanelLeftClose/>}</button></div>
    <nav ref={navigation} id="main-navigation" className="nav-list" aria-label="Main navigation"><span className="active-nav-trail" aria-hidden="true"/>{NAVIGATION.filter(item=>MEMBERSHIP_ENABLED||item.id!=='membership').map(({ id, zh, en, icon: Icon }) => {
      const label=id==='membership'&&membership.active?(english?'My membership':'我的会员'):(english?en:zh);
      return <button key={id} aria-label={label} title={collapsed?label:undefined} aria-current={page === id ? "page" : undefined} className={cn("nav-item", page === id && "active")} onClick={() => navigate(id)}><Icon /><span className="nav-label"><strong>{label}</strong></span>{id === "mistakes" && mistakeCount > 0 ? <em className="nav-count">{mistakeCount}</em> : page === id && <span className="nav-dot" />}</button>;
    })}</nav>
    <div className="sidebar-footer">{collapsed?<button className="sidebar-focus-shortcut" onClick={()=>navigate('focus')} aria-label={english?'Open focus timer':'打开专注计时'} title={english?'Open focus timer':'打开专注计时'}><Clock3/></button>:<FocusCountdown timer={focusTimer} language={language} onOpen={() => navigate("focus")} />}<Button variant="ghost" className="theme-button" aria-label={themeLabel} title={collapsed?themeLabel:undefined} onClick={toggleDark}>{dark ? <Sun /> : <Moon />}<span className="theme-label">{themeLabel}</span></Button></div>
  </aside>;
}
