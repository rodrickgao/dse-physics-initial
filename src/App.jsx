import { setUiLanguage, translate } from './lib/ui-translations';
import { AskTeacherView } from './views/AskTeacherView';
import { SubscriptionView, PaymentView, MemberWelcome } from './views/SubscriptionView';
import { MembershipProvider, MembershipStatus } from './components/Membership';
import { enableActivity, track } from './lib/activity';
import { QuestionSuggestions } from './components/QuestionSuggestions';
import { useFocusTimer } from './lib/use-focus-timer';
import { PomodoroView } from './views/PomodoroView';
import { DseCountdown } from './components/DseCountdown';
import { rememberAccount } from './lib/remembered-accounts';
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Atom, BookOpen, ChevronRight, CircleAlert, FileQuestion, Home, Timer, Crown, Languages, Moon, Search, Settings, Sun } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { cn } from "./lib/utils";
import { entriesByLanguage, statistics } from "./lib/data";
import { PapersView } from "./views/PapersView";
import { TextbookView } from "./views/TextbookView";
import { MistakesView } from "./views/MistakesView";
import { pageHash, readRoute, readSaved, writeSaved } from "./lib/study-state";

import { api } from "./lib/api";
import { LoginView } from "./views/LoginView";
import { ProfileView } from "./views/ProfileView";
import { AdminView } from "./views/AdminView";

const MISTAKE_STORAGE_KEY = "dse-physics-mistakes-v1";
const THEME_STORAGE_KEY = "dse-physics-theme-v1";
const NAVIGATION = [
  { id: "home", zh: "主页", en: "Home", icon: Home },
  { id: "papers", zh: "真题库", en: "Past papers", icon: FileQuestion },
  { id: "textbook", zh: "课本知识库", en: "Knowledge", icon: BookOpen },
  { id: "mistakes", zh: "错题库", en: "Mistakes", icon: CircleAlert },
  { id: "membership", zh: "开通会员", en: "Membership", icon: Crown },
  { id: "ask", zh: "问老师", en: "Ask a teacher", icon: BookOpen },
  { id: "focus", zh: "番茄钟", en: "Focus timer", icon: Timer },
];

function Sidebar({ page, navigate, dark, toggleDark, language, mistakeCount, focusTimer }) {
  return <aside className="sidebar">
    <button className="brand" onClick={() => navigate("home")}><span className="brand-mark"><Atom /></span><span><strong>DSE Physics</strong><small>学习题库</small></span></button>
    <nav className="nav-list" aria-label="Main navigation">{NAVIGATION.map(({ id, zh, en, icon: Icon }) => <button key={id} aria-current={page === id ? "page" : undefined} className={cn("nav-item", page === id && "active")} onClick={() => navigate(id)}><Icon /><span><strong>{zh}</strong></span>{id === "focus" && focusTimer?.running && <small className="nav-focus-time" aria-label="专注剩余时间">{Math.ceil(focusTimer.remaining / 60000)} {"分钟"}</small>}{id === "mistakes" && mistakeCount > 0 ? <em className="nav-count">{mistakeCount}</em> : page === id && <span className="nav-dot" />}</button>)}</nav>
    <div className="sidebar-footer"><Button variant="ghost" className="theme-button" onClick={toggleDark}>{dark ? <Sun /> : <Moon />}{dark ? ("浅色模式") : ("深色模式")}</Button></div>
  </aside>;
}

function Topbar({ user, language, setLanguage, submitSearch, page, onSelectQuestion }) {
  const [query, setQuery] = useState("");
  const search = useRef(null);
  useEffect(() => {
    const focus = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        (document.getElementById('paper-search') || search.current)?.focus();
      }
    };
    window.addEventListener('keydown', focus);
    return () => window.removeEventListener('keydown', focus);
  }, []);
  const submit = (event) => { event.preventDefault(); submitSearch(query); };
  return <header className="topbar">{page === 'papers' ? <div className="workspace-breadcrumb"><Atom/><span>DSE Physics</span><ChevronRight/><strong>{'真题库'}</strong></div> : <form className="global-search" onSubmit={submit}><Search /><input ref={search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={"输入题目中的几个字、年份或知识点"} aria-label="搜索题目" onKeyDown={event => { if (event.key === "Escape") setQuery(""); if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} /><QuestionSuggestions query={query} language={language} onSelect={key => { setQuery(""); onSelectQuestion(key); }} /></form>}<DseCountdown target={user?.target} targetMajor={user?.targetMajor} /><div className="topbar-actions"><Button variant="ghost" size="icon" onClick={() => setLanguage(language === "eng" ? "chn" : "eng")} aria-label="切换题目语言"><Languages /></Button><button className="language-pill" onClick={() => setLanguage(language === "eng" ? "chn" : "eng")}>{language === "eng" ? "ENG" : "中文"}</button></div></header>;
}

function HomeView({ language, navigate, mistakeCount }) {
  const isEnglish = language === "eng";
  const sections = [
    { id: "papers", index: "01", title: "真题库", metric: entriesByLanguage[language].length, metricLabel: "道题 · 2012–2025", icon: FileQuestion, tone: "blue" },
    { id: "textbook", index: "02", title: "课本知识库", metric: statistics.summary.knowledgePointCount, metricLabel: "个知识点", icon: BookOpen, tone: "amber" },
    { id: "mistakes", index: "03", title: "错题库", metric: mistakeCount, metricLabel: "道待复习", icon: CircleAlert, tone: "rose" },
    { id: "focus", index: "04", title: "番茄钟", metric: "30–180", metricLabel: "分钟 · 开始专注", icon: Timer, tone: "blue" },
  ];
  return <div className="home-view page-enter">
    <section className="welcome-row"><h1>DSE Physics</h1></section>
    <section className="section-grid">{sections.map(({ id, index, title, metric, metricLabel, icon: Icon, tone }) =>
      <Card key={id} className={cn("library-card", `tone-${tone}`)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(id); } }} onClick={() => navigate(id)}>
        <CardHeader><div className="library-card-top"><span className="library-icon"><Icon /></span><span className="card-index">{index}</span></div><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent><div className="metric"><strong>{metric}</strong><span>{metricLabel}</span></div><span className="open-link" aria-hidden="true"><ArrowRight /></span></CardContent>
      </Card>
    )}</section>
  </div>;
}

export function App() {
  const [user, setUser] = useState(null);
  const focusTimer = useFocusTimer(user?.id);
  const [editingProfile, setEditingProfile] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [mailMode, setMailMode] = useState('local');
  const [syncError, setSyncError] = useState('');
  const [saving, setSaving] = useState(false);
  const mutation = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const [legacy, setLegacy] = useState(() => {
    const saved = readSaved(MISTAKE_STORAGE_KEY, {});
    const valid = new Set(entriesByLanguage.chn.map(e => e.key));
    return saved && typeof saved === 'object' ? Object.keys(saved).filter(key => valid.has(key)) : [];
  });
  async function initialize() {
    setAuthError('');
    try {
      const result = await api('auth/session'); setMailMode(result.mailMode);
      if (result.user) { const saved = await api('mistakes'); setMistakes(saved.mistakes); setMastered(saved.mastered || {}); }
      rememberAccount(result.user); setUser(result.user); setAuthReady(true);
    } catch (e) { setAuthError(e.message); }
  }
  useEffect(() => { initialize(); }, []);
  async function loggedIn(nextUser) {
    rememberAccount(nextUser);
    const saved = await api('mistakes'); setMistakes(saved.mistakes); setMastered(saved.mastered || {}); setUser(nextUser); setSyncError('');
    setEditingProfile(false);
    if (nextUser.role === 'admin') navigate('admin'); else navigate('home');
  }
  async function logout() {
    if (mutation.current || !window.confirm(translate("确认退登"))) return;
    try { await api('auth/logout', {}); setUser(null); setMistakes({}); setMastered({}); setSyncError(''); setEditingProfile(false); }
    catch (e) { setSyncError(e.message); }
  }
  async function saveMistakes(path, body, method) {
    mutation.current++; setSaving(true); setSyncError('');
    const operation = saveQueue.current.then(async () => {
      try { const result = await api(path, body, method); setMistakes(result.mistakes); setMastered(result.mastered || {}); return true; }
      catch (e) { setSyncError(e.message); if (e.status === 401) { setUser(null); setMistakes({}); setMastered({}); } return false; }
      finally { mutation.current--; setSaving(mutation.current > 0); }
    });
    saveQueue.current = operation;
    return operation;
  }
  async function importLegacy() {
    if (await saveMistakes('mistakes/import', { keys: legacy })) {
      writeSaved(MISTAKE_STORAGE_KEY, {}); setLegacy([]);
    }
  }
  useEffect(() => { enableActivity(user?.role === 'student' && user.profileComplete); return () => enableActivity(false); }, [user?.id, user?.profileComplete]);
  const [page, setPage] = useState(() => readRoute(location.hash).page);
  const [language, setLanguage] = useState(() => { try { const saved = localStorage.getItem("dse-physics-language-v1"); return ["eng", "chn"].includes(saved) ? saved : "chn"; } catch { return "chn"; } });
  setUiLanguage(language);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [mistakes, setMistakes] = useState({});
  const [mastered, setMastered] = useState({});
  const [askTarget, setAskTarget] = useState(null);
  const askTeacher = (kind, reference) => { setAskTarget({kind,reference:String(reference)}); navigate('ask'); };
  const setProgress = (keys,status) => saveMistakes('progress',{keys,status},'PUT');
  const lastPaper = useRef(readRoute(location.hash).question || readSaved('dse-physics-last-question-v1', ''));
  const [paperTarget, setPaperTarget] = useState(() => readRoute(location.hash).question || '');
  const [paperDirectoryVersion, setPaperDirectoryVersion] = useState(0);
  const [knowledgeTarget, setKnowledgeTarget] = useState(() => Number(new URLSearchParams(location.hash.split("?")[1]).get("knowledge")) || null);
  const [paperQuery, setPaperQuery] = useState("");
  useEffect(() => { if (user?.profileComplete) track('page_view', editingProfile ? 'profile' : page); }, [page, editingProfile, user?.id, user?.profileComplete]);
  const dataReady = Boolean(window.DSE_SITE_DATA && window.DSE_TEXTBOOK_DATA && window.DSE_STATISTICS);
  const navigate = useCallback((next, question = '') => { setPage(next); if (next !== "papers") setPaperQuery(""); if (next === 'papers') { setPaperTarget(question); if (!question) setPaperDirectoryVersion(v => v + 1); } const hash = pageHash(next, question); if (location.hash !== hash) history.pushState({ page: next }, "", hash); window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  useEffect(() => { const handler = () => { const route = readRoute(location.hash); setPage(route.page); if (route.page === 'papers') { setPaperTarget(route.question || ''); if (!route.question) setPaperDirectoryVersion(v => v + 1); } }; addEventListener("popstate", handler); addEventListener('hashchange', handler); return () => { removeEventListener("popstate", handler); removeEventListener('hashchange', handler); }; }, []);
  useEffect(() => { try { localStorage.setItem("dse-physics-language-v1", language); } catch { /* Reading remains available in private browsers. */ } document.documentElement.lang = language === "eng" ? "en" : "zh-CN"; }, [language]);
  const toggleDark = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); try { localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light"); } catch { /* Session-only preference. */ } };
  const setMistake = (key, marked) => saveMistakes('mistakes', { key, marked }, 'PUT');
  const openPaper = (key) => { lastPaper.current = key; navigate("papers", key); };
  const rememberQuestion = useCallback((key) => { track('question_view', key); lastPaper.current = key; writeSaved('dse-physics-last-question-v1', key); if (readRoute(location.hash).page === 'papers') history.replaceState({}, '', pageHash('papers', key)); }, []);
  const openKnowledge = (sequence) => { track('knowledge_view', String(sequence)); setKnowledgeTarget(Number(sequence)); navigate("textbook"); };
  const submitSearch = (query) => { track('search', query); setPaperQuery(query); navigate("papers"); };
  const clearPaperTarget = useCallback(() => setPaperTarget(""), []);
  const clearKnowledgeTarget = useCallback(() => setKnowledgeTarget(null), []);
  if (page === 'admin') { location.replace('/admin.html'); return null; }
  if (!authReady) return <div className="account-loading"><p role={authError ? 'alert' : 'status'}>{authError || '正在加载账号…'}</p>{authError && <Button onClick={initialize}>重试连线</Button>}</div>;
  if (!user) return <LoginView language={language} setLanguage={setLanguage} onLogin={loggedIn} mailMode={mailMode} />;
  if (user.role === 'student' && (!user.profileComplete || editingProfile)) return <MembershipProvider userId={user.id}><ProfileView logoutError={syncError} key={user.id} user={user} mistakes={mistakes} language={language} openPaper={key => { setEditingProfile(false); openPaper(key); }} openKnowledge={sequence => { setEditingProfile(false); openKnowledge(sequence); }} onSaved={next => { setUser(next); setEditingProfile(false); }} onLogout={logout} onCancel={user.profileComplete ? () => { setEditingProfile(false); navigate("home"); } : undefined} /></MembershipProvider>;
  if (!dataReady) return <div className="fatal-state">Study data could not be loaded.</div>;
  return <MembershipProvider userId={user.id}><div className="app-shell"><a className="skip-link" href="#main-content" onClick={(e) => { e.preventDefault(); document.getElementById("main-content")?.focus(); }}>{"跳至主要内容"}</a><Sidebar focusTimer={focusTimer} page={page} navigate={navigate} dark={dark} toggleDark={toggleDark} language={language} mistakeCount={Object.keys(mistakes).length} /><div className="app-main"><Topbar user={user} onSelectQuestion={openPaper} language={language} setLanguage={setLanguage} submitSearch={submitSearch} page={page} /><div className="account-bar"><MembershipStatus/>{user.avatarUrl && <img className="account-avatar" src={user.avatarUrl} alt="我的头像" />}<span>{user.role === "admin" ? "开发者" : user.nickname || user.email}</span>{user.role === "student" && <button className="account-settings" disabled={saving} onClick={() => setEditingProfile(true)}><Settings aria-hidden="true" />个人设置</button>}{saving && <span role="status">正在保存…</span>}{user.role === "admin" && <button onClick={() => navigate("admin")}>统计后台</button>}{user.role === "admin" && <button disabled={saving} onClick={logout}>退出登录</button>}</div><main id="main-content" tabIndex={-1} className="content"><PomodoroView timer={focusTimer} language={language} visible={page === "focus"} />{syncError && <p className="account-error" role="alert">{syncError}</p>}{legacy.length > 0 && user.role === 'student' && <div className="import-banner"><span>此浏览器有 {legacy.length} 道旧错题。确认属于自己后，可导入目前账号。</span><Button disabled={saving} onClick={importLegacy}>导入我的错题</Button><Button variant="ghost" onClick={() => setLegacy([])}>稍后处理</Button></div>}{page === 'admin' && (user.role === 'admin' ? <AdminView openPaper={openPaper} openKnowledge={openKnowledge} /> : <p>此页面只限开发者存取。</p>)}{(page === "activating" || page === "member-success") && <MemberWelcome navigate={navigate} activating={page === "activating"}/>} {page === "membership" && <SubscriptionView navigate={navigate}/>} {(page === "payment" || page === "receipt") && <PaymentView navigate={navigate} user={user} uploadPage={page === "receipt"}/>} {page === "ask" && <AskTeacherView language={language} target={askTarget} openPaper={openPaper} openKnowledge={openKnowledge}/>} {page === "home" && <HomeView language={language} navigate={navigate} mistakeCount={Object.keys(mistakes).length} />}{page === "papers" && <PapersView mastered={mastered} setProgress={setProgress} saving={saving} directoryVersion={paperDirectoryVersion} onDirectory={() => navigate("papers")} onYearOpen={openPaper} language={language} mistakes={mistakes} setMistake={setMistake} targetKey={paperTarget} clearTarget={clearPaperTarget} initialQuery={paperQuery} onQuestionChange={rememberQuestion} openKnowledge={openKnowledge} />}{page === "textbook" && <TextbookView askTeacher={askTeacher} language={language} targetSequence={knowledgeTarget} clearTarget={clearKnowledgeTarget} openPaper={openPaper} openKnowledge={openKnowledge} />}{page === "mistakes" && <MistakesView setProgress={setProgress} saving={saving} manageTrash={(action, keys) => saveMistakes('mistakes/trash', { action, keys }, 'POST')} language={language} mistakes={mistakes} setMistake={setMistake} openPaper={openPaper} browsePapers={() => navigate("papers")} />}</main></div><nav className="mobile-nav" aria-label="Mobile navigation">{NAVIGATION.map(({ id, zh, en, icon: Icon }) => <button key={id} aria-current={page === id ? "page" : undefined} className={cn(page === id && "active")} onClick={() => navigate(id)}><Icon /><span>{language === "eng" ? ({home:"Home",papers:"Papers",textbook:"Topics",mistakes:"Mistakes",membership:"Member",ask:"Teacher",focus:"Focus"}[id]) : zh.replace("库", "")}</span></button>)}</nav></div></MembershipProvider>;
}
