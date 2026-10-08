import { LearningTour } from './components/LearningTour';
import { SearchReturn } from './components/SearchReturn';
import { ExamplesView } from './views/ExamplesView';
import { FocusCountdown } from './components/FocusCountdown';
import { MobileNavigation } from './components/MobileNavigation';
import { StudyDashboard } from './components/StudyDashboard';
import { QuestionBankView } from './views/QuestionBankView';
import { ExercisesView } from './views/ExercisesView';
import { LanguageSwitch } from './components/LanguageSwitch';
import { setUiLanguage, translate } from './lib/ui-translations';
import { AskTeacherView } from './views/AskTeacherView';
import { rememberReader, useReaderReturn, ReaderReturn } from './lib/reader-return';
import { currentTeacherContext } from './lib/teacher-context';
import { SubscriptionView, PaymentView, MemberWelcome } from './views/SubscriptionView';
import { MembershipProvider, MembershipStatus, useMembership } from './components/Membership';
import { enableActivity, track } from './lib/activity';
import { QuestionSuggestions } from './components/QuestionSuggestions';
import { useFocusTimer } from './lib/use-focus-timer';
import { PomodoroView } from './views/PomodoroView';
import { DseCountdown } from './components/DseCountdown';
import { rememberAccount } from './lib/remembered-accounts';
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Atom, BookOpen, Clock3, PanelLeftClose, PanelLeftOpen, ChevronRight, CircleAlert, FileQuestion, Home, Crown, Languages, Moon, Search, Settings, Sun } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { cn } from "./lib/utils";
import { entriesByLanguage, statistics } from "./lib/data";
import { PapersView } from "./views/PapersView";
import { TextbookView } from "./views/TextbookView";
import { MistakesView } from "./views/MistakesView";
import { pageHash, readRoute, exerciseBookFromHash, readSaved, writeSaved } from "./lib/study-state";

import { api } from "./lib/api";
import { LoginView } from "./views/LoginView";
import { ProfileView } from "./views/ProfileView";
import { AdminView } from "./views/AdminView";

const MISTAKE_STORAGE_KEY = "dse-physics-mistakes-v1";
const THEME_STORAGE_KEY = "dse-physics-theme-v1";
const NAVIGATION = [
  { id: "home", zh: "主页", en: "Home", icon: Home },
  { id: "bank", zh: "题库", en: "Question bank", icon: FileQuestion },
  { id: "textbook", zh: "课本知识库", en: "Knowledge", icon: BookOpen },
  { id: "mistakes", zh: "错题库", en: "Mistakes", icon: CircleAlert },
  { id: "membership", zh: "开通会员", en: "Membership", icon: Crown },
  { id: "ask", zh: "问老师", en: "Ask a teacher", icon: BookOpen },
];

function Sidebar({ page, navigate, dark, toggleDark, language, mistakeCount, focusTimer, collapsed, toggleCollapsed }) {
  const membership=useMembership(),english=language==='eng';
  const toggleLabel=collapsed?(english?'Expand navigation':'展开目录'):(english?'Collapse navigation':'收起目录');
  const themeLabel=dark?(english?'Light mode':'浅色模式'):(english?'Dark mode':'深色模式');
  return <aside className="sidebar" aria-label={english?'Main navigation':'主目录'}>
    <div className="sidebar-heading"><button className="brand" aria-label="DSE Physics" title="DSE Physics" onClick={() => navigate("home")}><span className="brand-mark"><Atom /></span><span className="brand-copy"><strong>DSE Physics</strong><small>{english?'Study library':'学习题库'}</small></span></button>
    <button className="sidebar-toggle" onClick={toggleCollapsed} aria-expanded={!collapsed} aria-controls="main-navigation" aria-label={toggleLabel} title={toggleLabel}>{collapsed?<PanelLeftOpen/>:<PanelLeftClose/>}</button></div>
    <nav id="main-navigation" className="nav-list" aria-label="Main navigation">{NAVIGATION.map(({ id, zh, en, icon: Icon }) => {
      const label=id==='membership'&&membership.active?(english?'My membership':'我的会员'):(english?en:zh);
      return <button key={id} aria-label={label} title={collapsed?label:undefined} aria-current={page === id ? "page" : undefined} className={cn("nav-item", page === id && "active")} onClick={() => navigate(id)}><Icon /><span className="nav-label"><strong>{label}</strong></span>{id === "mistakes" && mistakeCount > 0 ? <em className="nav-count">{mistakeCount}</em> : page === id && <span className="nav-dot" />}</button>;
    })}</nav>
    <div className="sidebar-footer">{collapsed?<button className="sidebar-focus-shortcut" onClick={()=>navigate('focus')} aria-label={english?'Open focus timer':'打开专注计时'} title={english?'Open focus timer':'打开专注计时'}><Clock3/></button>:<FocusCountdown timer={focusTimer} language={language} onOpen={() => navigate("focus")} />}<Button variant="ghost" className="theme-button" aria-label={themeLabel} title={collapsed?themeLabel:undefined} onClick={toggleDark}>{dark ? <Sun /> : <Moon />}<span className="theme-label">{themeLabel}</span></Button></div>
  </aside>;
}

function Topbar({ user, language, setLanguage, submitSearch, page, onSelectQuestion }) {
  const [query, setQuery] = useState("");
  const search = useRef(null);
  useEffect(() => {
    const focus = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        (document.getElementById('bank-search') || search.current)?.focus();
      }
    };
    window.addEventListener('keydown', focus);
    return () => window.removeEventListener('keydown', focus);
  }, []);
  const submit = (event) => { event.preventDefault(); submitSearch(query); };
  return <header className="topbar">{page === 'bank' ? <div className="workspace-breadcrumb"><Atom/><span>DSE Physics</span><ChevronRight/><strong>{'题库'}</strong></div> : <form className="global-search" onSubmit={submit} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setQuery(""); }} onKeyDown={event => { if (event.nativeEvent.isComposing) return; if (event.key === "Escape") { setQuery(""); search.current?.focus(); } if (!["ArrowDown", "ArrowUp"].includes(event.key)) return; const items = [...event.currentTarget.querySelectorAll(".global-question-results button")]; if (!items.length) return; event.preventDefault(); const index = items.indexOf(document.activeElement); const next = event.key === "ArrowDown" ? index + 1 : index - 1; (next < 0 || next >= items.length ? search.current : items[next])?.focus(); }}><Search /><input type="search" ref={search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={language === "eng" ? "Search questions, situations or topics" : "描述想练的题目、情境或知识点"} aria-label={language === "eng" ? "Search questions" : "搜索题目"} onKeyDown={event => { if (event.key === "Escape") setQuery(""); if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} /><QuestionSuggestions query={query} language={language} onSelect={key => { setQuery(""); onSelectQuestion(key); }} /></form>}<DseCountdown target={user?.target} targetMajor={user?.targetMajor} /></header>;
}

function HomeView({ language, navigate, mistakeCount, userId, mistakes, mastered, openQuestion, openKnowledge }) {
  const isEnglish = language === "eng";
  const sections = [
    { id: "bank", index: "01", title: "题库", metric: "", metricLabel: isEnglish ? "Past papers · Exercises · Examples" : "真题 · 课本习题 · 课本例题", icon: FileQuestion, tone: "blue" },
    { id: "textbook", index: "02", title: "课本知识库", metric: statistics.summary.knowledgePointCount, metricLabel: "个知识点", icon: BookOpen, tone: "amber" },
    { id: "mistakes", index: "03", title: "错题库", metric: mistakeCount, metricLabel: "道待复习", icon: CircleAlert, tone: "rose" },
  ];
  return <div className="home-view page-enter">
    <section className="welcome-row"><h1>{isEnglish ? "My study desk" : "我的学习"}</h1></section><StudyDashboard mastered={mastered} userId={userId} language={language} mistakes={mistakes} openQuestion={openQuestion} openKnowledge={openKnowledge} navigate={navigate}/>
    <section className="section-grid">{sections.map(({ id, index, title, metric, metricLabel, icon: Icon, tone }) =>
      <Card key={id} className={cn("library-card", `tone-${tone}`)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(id); } }} onClick={() => navigate(id)}>
        <CardHeader><div className="library-card-top"><span className="library-icon"><Icon /></span><span className="card-index">{index}</span></div><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent><div className="metric"><strong>{metric}</strong><span>{metricLabel}</span></div><span className="open-link" aria-hidden="true"><ArrowRight /></span></CardContent>
      </Card>
    )}</section>
  </div>;
}

export function App() {
  const [sidebarCollapsed,setSidebarCollapsed]=useState(()=>readSaved('dse-sidebar-collapsed-v1',false)===true);
  const toggleSidebar=()=>setSidebarCollapsed(previous=>{const next=!previous;writeSaved('dse-sidebar-collapsed-v1',next);return next;});
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
      try { const result = await api(path, body, method); setMistakes(result.mistakes); setMastered(result.mastered || {}); return result; }
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
  const [feedback,setFeedback] = useState(null);
  useEffect(()=>{if(!feedback)return;const timer=setTimeout(()=>setFeedback(null),20000);return()=>clearTimeout(timer);},[feedback]);
  const setProgress = async (keys,status) => {
    const result=await saveMistakes('progress',{keys,status},'PUT');
    if(result) setFeedback({id:result.undoId,text:language==='eng' ? `${keys.length} question${keys.length>1?'s':''} ${status==='mastered'?'marked as mastered':'reset'}.` : `${status==='mastered'?'已掌握':'已重置'} ${keys.length} 题`});
    return result;
  };
  const undoProgress=async()=>{if(await saveMistakes('progress/undo',{id:feedback.id},'POST'))setFeedback({text:language==='eng'?'Previous learning status restored.':'已恢复之前的学习状态'});};
  const lastPaper = useRef((readRoute(location.hash).page === 'papers' ? readRoute(location.hash).question : '') || readSaved('dse-physics-last-question-v1', ''));
  const [paperTarget, setPaperTarget] = useState(() => readRoute(location.hash).question || '');
  const [exerciseBook,setExerciseBook] = useState(()=>exerciseBookFromHash(location.hash));
  const [exerciseTarget, setExerciseTarget] = useState(() => ["exercises", "examples"].includes(readRoute(location.hash).page) ? readRoute(location.hash).question : "");
  const [paperDirectoryVersion, setPaperDirectoryVersion] = useState(0);
  const [knowledgeTarget, setKnowledgeTarget] = useState(() => Number(new URLSearchParams(location.hash.split("?")[1]).get("knowledge")) || null);
  const [paperQuery, setPaperQuery] = useState("");
  const [bankQuery, setBankQuery] = useState('');
  useEffect(() => { if (user?.profileComplete) track('page_view', editingProfile ? 'profile' : page); }, [page, editingProfile, user?.id, user?.profileComplete]);
  const dataReady = Boolean(window.DSE_SITE_DATA && window.DSE_TEXTBOOK_DATA && window.DSE_STATISTICS);
  const navigate = useCallback((next, question = '', options = {}) => { setEditingProfile(false); if(next==='textbook'&&options.knowledge)setKnowledgeTarget(Number(options.knowledge)); if (next === 'ask' && readRoute(location.hash).page !== 'ask') setAskTarget(currentTeacherContext(readRoute(location.hash).page)); setPage(next); if (["exercises", "examples"].includes(next)) {setExerciseTarget(question);setExerciseBook(options.book || '');} if (next !== "papers") setPaperQuery(""); if (next === 'papers') { setPaperTarget(question); if (!question) setPaperDirectoryVersion(v => v + 1); } const hash = pageHash(next, question, options); if (location.hash !== hash) history.pushState({ page: next }, "", hash); if (!question) window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  useEffect(() => { const handler = () => { const route = readRoute(location.hash); setEditingProfile(false); setPage(route.page); if(route.page === "textbook") setKnowledgeTarget(Number(new URLSearchParams(location.hash.split("?")[1]).get("knowledge")) || null); if (["exercises", "examples"].includes(route.page)) {setExerciseTarget(route.question);setExerciseBook(exerciseBookFromHash(location.hash));} if (route.page === 'papers') { setPaperTarget(route.question || ''); if (!route.question) setPaperDirectoryVersion(v => v + 1); } }; addEventListener("popstate", handler); addEventListener('hashchange', handler); return () => { removeEventListener("popstate", handler); removeEventListener('hashchange', handler); }; }, []);
  useEffect(() => { try { localStorage.setItem("dse-physics-language-v1", language); } catch { /* Reading remains available in private browsers. */ } document.documentElement.lang = language === "eng" ? "en" : "zh-CN"; }, [language]);
  const toggleDark = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); try { localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light"); } catch { /* Session-only preference. */ } };
  const setMistake = (key, marked) => saveMistakes('mistakes', { key, marked }, 'PUT');
  const openPaper = (key) => { if(key.startsWith('knowledge-')){openKnowledge(Number(key.slice(10)));return;} if(key.startsWith('ex-')){navigate('examples',key);return;} if (key.startsWith('tb-')) { navigate('exercises', key); return; } lastPaper.current = key; navigate("papers", key); };
  const rememberQuestion = useCallback((key) => { track('question_view', key); lastPaper.current = key; writeSaved('dse-physics-last-question-v1', key); if(user?.id)writeSaved(`dse-last-study-${user.id}`,{key}); if (readRoute(location.hash).page === 'papers') history.replaceState({}, '', pageHash('papers', key)); }, [user?.id]);
  const openExercise = (key, book = '') => navigate("exercises", key, {book});
  useEffect(()=>{
    if (!user?.id) return;
    const key=['exercises','examples'].includes(page)?exerciseTarget:page==='papers'?paperTarget:'';
    if(key) writeSaved(`dse-last-study-${user.id}`,{key});
  },[user?.id,page,exerciseTarget,paperTarget]);
  useReaderReturn(page,user?.id);
  const openKnowledge = (sequence) => { rememberReader(user?.id); track('knowledge_view', String(sequence)); setKnowledgeTarget(Number(sequence)); navigate("textbook", '', {knowledge:Number(sequence)}); };
  const submitSearch = (query) => { track('search', query); setBankQuery(query); navigate("bank"); };
  const clearPaperTarget = useCallback(() => setPaperTarget(""), []);
  const clearKnowledgeTarget = useCallback(() => setKnowledgeTarget(null), []);
  const navigationPage = ['papers', 'exercises', 'examples'].includes(page) ? 'bank' : page;
  const withLanguage = content => <><LanguageSwitch language={language} setLanguage={setLanguage}/>{content}</>;
  if (page === 'admin') { location.replace('/admin.html'); return null; }
  if (!authReady) return withLanguage(<div className="account-loading"><p role={authError ? 'alert' : 'status'}>{authError || '正在加载账号…'}</p>{authError && <Button onClick={initialize}>重试连线</Button>}</div>);
  if (!user) return withLanguage(<LoginView language={language} setLanguage={setLanguage} onLogin={loggedIn} mailMode={mailMode} />);
  if (user.role === 'student' && !user.profileComplete) return withLanguage(<MembershipProvider userId={user.id}><ProfileView dark={dark} toggleDark={toggleDark} logoutError={syncError} key={user.id} user={user} mistakes={mistakes} language={language} openPaper={key => { setEditingProfile(false); openPaper(key); }} openKnowledge={sequence => { setEditingProfile(false); openKnowledge(sequence); }} onSaved={next => { setUser(next); setEditingProfile(false); }} onLogout={logout} onCancel={user.profileComplete ? () => { setEditingProfile(false); navigate("home"); } : undefined} /></MembershipProvider>);
  if (!dataReady) return withLanguage(<div className="fatal-state">Study data could not be loaded.</div>);
  return withLanguage(<MembershipProvider userId={user.id}><div className={cn("app-shell",sidebarCollapsed&&"sidebar-collapsed")}><a className="skip-link" href="#main-content" onClick={(e) => { e.preventDefault(); document.getElementById("main-content")?.focus(); }}>{"跳至主要内容"}</a><Sidebar collapsed={sidebarCollapsed} toggleCollapsed={toggleSidebar} focusTimer={focusTimer} page={navigationPage} navigate={navigate} dark={dark} toggleDark={toggleDark} language={language} mistakeCount={Object.keys(mistakes).length} /><div className="app-main"><Topbar user={user} onSelectQuestion={openPaper} language={language} setLanguage={setLanguage} submitSearch={submitSearch} page={page} /><div className="account-bar"><MembershipStatus/><LearningTour key={user.id} userId={user.id} page={editingProfile?'profile':page} language={language} navigate={navigate}/>{user.avatarUrl && <img className="account-avatar" src={user.avatarUrl} alt="我的头像" />}<span>{user.role === "admin" ? "开发者" : user.nickname || user.email}</span>{user.role === "student" && <button data-tour="profile-settings" className="account-settings" disabled={saving} onClick={() => setEditingProfile(true)}><Settings aria-hidden="true" />个人设置</button>}{saving && <span role="status">正在保存…</span>}{user.role === "admin" && <button onClick={() => navigate("admin")}>统计后台</button>}{user.role === "admin" && <button disabled={saving} onClick={logout}>退出登录</button>}</div><main data-tour="page-root" data-tour-page={editingProfile?'profile':page} id="main-content" tabIndex={-1} className="content">{editingProfile ? <ProfileView dark={dark} toggleDark={toggleDark} embedded logoutError={syncError} user={user} language={language} onSaved={next=>{setUser(next);setEditingProfile(false);}} onLogout={logout} onCancel={()=>setEditingProfile(false)}/> : <><PomodoroView timer={focusTimer} language={language} visible={page === "focus"} />{feedback && <div className="study-feedback" role="status"><span>{feedback.text}</span>{feedback.id && <Button variant="ghost" disabled={saving} onClick={undoProgress}>{language==='eng'?'Undo':'撤销'}</Button>}<button aria-label={language==='eng'?'Dismiss':'关闭提示'} onClick={()=>setFeedback(null)}>×</button></div>}{syncError && <p className="account-error" role="alert">{syncError}</p>}{legacy.length > 0 && user.role === 'student' && <div className="import-banner"><span>此浏览器有 {legacy.length} 道旧错题。确认属于自己后，可导入目前账号。</span><Button disabled={saving} onClick={importLegacy}>导入我的错题</Button><Button variant="ghost" onClick={() => setLegacy([])}>稍后处理</Button></div>}{page === 'admin' && (user.role === 'admin' ? <AdminView language={language} openPaper={openPaper} openKnowledge={openKnowledge} /> : <p>此页面只限开发者存取。</p>)}{(page === "activating" || page === "member-success") && <MemberWelcome navigate={navigate} activating={page === "activating"}/>} {page === "membership" && <SubscriptionView navigate={navigate}/>} {(page === "payment" || page === "receipt") && <PaymentView navigate={navigate} user={user} uploadPage={page === "receipt"}/>} {page === "ask" && <AskTeacherView userId={user.id} language={language} target={askTarget} openPaper={openPaper} openKnowledge={openKnowledge}/>} {page === "home" && <HomeView mastered={mastered} userId={user.id} mistakes={mistakes} openQuestion={openPaper} openKnowledge={openKnowledge} language={language} navigate={navigate} mistakeCount={Object.keys(mistakes).length} />}{page === "bank" && <QuestionBankView language={language} navigate={navigate} initialQuery={bankQuery} openQuestion={openPaper} openKnowledge={openKnowledge} />}{page === "papers" && <PapersView onBank={()=>navigate('bank')} onAsk={() => navigate('ask')} mastered={mastered} setProgress={setProgress} saving={saving} directoryVersion={paperDirectoryVersion} onDirectory={() => navigate("papers")} onYearOpen={openPaper} language={language} mistakes={mistakes} setMistake={setMistake} targetKey={paperTarget} clearTarget={clearPaperTarget} initialQuery={paperQuery} onQuestionChange={rememberQuestion} openKnowledge={openKnowledge} />}{page === "examples" && <ExamplesView mastered={mastered} mistakes={mistakes} saving={saving} setProgress={setProgress} setMistake={setMistake} onAsk={()=>navigate("ask")} targetBook={exerciseBook} language={language} targetKey={exerciseTarget} navigate={navigate} openKnowledge={openKnowledge}/>} {page === "exercises" && <ExercisesView onBank={()=>navigate('bank')} targetBook={exerciseBook} onAsk={() => navigate('ask')} mastered={mastered} mistakes={mistakes} setProgress={setProgress} setMistake={setMistake} saving={saving} language={language} targetKey={exerciseTarget} openExercise={openExercise} openKnowledge={openKnowledge} />}{page === "textbook" && <ReaderReturn userId={user.id} language={language}/>} {page === "textbook" && <SearchReturn language={language} questionKey={`knowledge-${new URLSearchParams(location.hash.split("?")[1]).get("knowledge")}`}/>}{page === "textbook" && <TextbookView mastered={mastered} mistakes={mistakes} language={language} targetSequence={knowledgeTarget} clearTarget={clearKnowledgeTarget} openPaper={openPaper} openExercise={openExercise} openKnowledge={openKnowledge} />}{page === "mistakes" && <MistakesView mastered={mastered} openKnowledge={openKnowledge} setProgress={setProgress} saving={saving} manageTrash={(action, keys) => saveMistakes('mistakes/trash', { action, keys }, 'POST')} language={language} mistakes={mistakes} setMistake={setMistake} openPaper={openPaper} browsePapers={() => navigate("bank")} />}</>}</main></div><FocusCountdown mobile timer={focusTimer} language={language} onOpen={() => navigate("focus")} /><MobileNavigation page={navigationPage} language={language} navigate={navigate}/></div></MembershipProvider>);
}

