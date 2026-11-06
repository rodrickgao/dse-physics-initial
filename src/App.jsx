import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { StudyPages } from './views/StudyPages';
import { useContentMotion } from './lib/use-content-motion';
import { startPageVisits } from './lib/page-visits';
import { LifeBuoy } from 'lucide-react';
import { LearningTour } from './components/LearningTour';
import { FocusCountdown } from './components/FocusCountdown';
import { MobileNavigation } from './components/MobileNavigation';
import { LanguageSwitch } from './components/LanguageSwitch';
import { setUiLanguage, translate } from './lib/ui-translations';
import { rememberReader, useReaderReturn } from "./lib/reader-return";
import { currentTeacherContext } from './lib/teacher-context';
import { MembershipProvider, MembershipStatus } from "./components/Membership";
import { enableActivity, track } from './lib/activity';
import { useFocusTimer } from './lib/use-focus-timer';
import { PomodoroView } from './views/PomodoroView';
import { rememberAccount } from './lib/remembered-accounts';
import { useCallback, useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "./components/ui/button";
import { cn } from "./lib/utils";
import { entriesByLanguage } from "./lib/data";
import { pageHash, readRoute, exerciseBookFromHash, readSaved, writeSaved } from "./lib/study-state";
import { api } from "./lib/api";
import { LoginView } from "./views/LoginView";
import { ProfileView } from "./views/ProfileView";


const MISTAKE_STORAGE_KEY = "dse-physics-mistakes-v1";
const THEME_STORAGE_KEY = "dse-physics-theme-v1";
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
  const progressRevision = useRef(0);
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
    mutation.current++; progressRevision.current++; setSaving(true); setSyncError('');
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
  useEffect(() => { if(user?.role === 'student' && user.profileComplete) return startPageVisits(editingProfile ? 'profile' : undefined); }, [user?.id,user?.profileComplete,editingProfile]);
  useEffect(() => { enableActivity(user?.role === 'student' && user.profileComplete); return () => enableActivity(false); }, [user?.id, user?.profileComplete]);
  const [page, setPage] = useState(() => readRoute(location.hash).page);
  const [language, setLanguage] = useState(() => { try { const saved = localStorage.getItem("dse-physics-language-v1"); return ["eng", "chn"].includes(saved) ? saved : "chn"; } catch { return "chn"; } });
  setUiLanguage(language);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [mistakes, setMistakes] = useState({});
  const [mastered, setMastered] = useState({});
  useEffect(() => {
    if (!authReady) return;
    let live=true,busy=false,pending=false;
    async function refreshProgress() {
      if (!live || mutation.current) return;
      if (busy) {pending=true;return;}
      busy=true;const revision=progressRevision.current;
      try {
        const session=await api('auth/session');
        if (!live || mutation.current || progressRevision.current!==revision) return;
        if (!session.user) {
          if(user){progressRevision.current++;setUser(null);setMistakes({});setMastered({});setEditingProfile(false);}
          return;
        }
        if(session.user.id!==user?.id){progressRevision.current++;location.reload();return;}
        const saved=await api('mistakes');
        if (!live || mutation.current || progressRevision.current!==revision) return;
        setMistakes(previous=>JSON.stringify(previous)===JSON.stringify(saved.mistakes)?previous:saved.mistakes);
        setMastered(previous=>JSON.stringify(previous)===JSON.stringify(saved.mastered||{})?previous:saved.mastered||{});
      } catch(error) {
        if(live&&error.status===401&&progressRevision.current===revision&&!mutation.current){
          progressRevision.current++;setUser(null);setMistakes({});setMastered({});setEditingProfile(false);
        }
        // Keep cached progress during a temporary connection failure.
      }
      finally { busy=false;if(live&&pending){pending=false;void refreshProgress();} }
    }
    const visible=()=>{if(document.visibilityState==='visible')void refreshProgress();};
    void refreshProgress();
    window.addEventListener('focus',refreshProgress);window.addEventListener('pageshow',refreshProgress);document.addEventListener('visibilitychange',visible);
    return ()=>{live=false;window.removeEventListener('focus',refreshProgress);window.removeEventListener('pageshow',refreshProgress);document.removeEventListener('visibilitychange',visible);};
  }, [authReady,user?.id,user?.profileComplete,page,editingProfile]);
  const [askTarget, setAskTarget] = useState(null);
  const setProgress = (keys,status) => saveMistakes('progress',{keys,status},'PUT');
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
  const pageMotion = useRef(null);
  useContentMotion(pageMotion, `${editingProfile ? 'profile' : page}:${language}`, '', { initial: true, ready: Boolean(authReady && user?.profileComplete && dataReady) });
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
  const openKnowledge = (sequence, review = {}) => { rememberReader(user?.id); track('knowledge_view', String(sequence)); setKnowledgeTarget(Number(sequence)); navigate("textbook", '', {knowledge:Number(sequence),weakRevision:review.weakRevision}); };
  const submitSearch = (query) => { track('search', query); setBankQuery(query); navigate("bank"); };
  const clearPaperTarget = useCallback(() => setPaperTarget(""), []);
  const clearKnowledgeTarget = useCallback(() => setKnowledgeTarget(null), []);
  const navigationPage = ['papers', 'exercises', 'examples'].includes(page) ? 'bank' : page;
  const withLanguage = content => <>{user && <button className="top-support" type="button" onClick={()=>navigate('support')} aria-label={language==='eng'?'Technical support':'技术支持'} title={language==='eng'?'Technical support':'技术支持'}><LifeBuoy aria-hidden="true"/><span>{language==='eng'?'Technical support':'技术支持'}</span></button>}<LanguageSwitch language={language} setLanguage={setLanguage}/>{content}</>;
  if (page === 'admin') { location.replace('/admin.html'); return null; }
  if (!authReady) return withLanguage(<div className="account-loading"><p role={authError ? 'alert' : 'status'}>{authError || '正在加载账号…'}</p>{authError && <Button onClick={initialize}>重试连线</Button>}</div>);
  if (!user) return withLanguage(<LoginView language={language} setLanguage={setLanguage} onLogin={loggedIn} mailMode={mailMode} />);
  if (user.role === 'student' && !user.profileComplete) return withLanguage(<MembershipProvider userId={user.id}><ProfileView logoutError={syncError} key={user.id} user={user} mistakes={mistakes} language={language} openPaper={key => { setEditingProfile(false); openPaper(key); }} openKnowledge={sequence => { setEditingProfile(false); openKnowledge(sequence); }} onSaved={next => { setUser(next); setEditingProfile(false); }} onLogout={logout} onCancel={user.profileComplete ? () => { setEditingProfile(false); navigate("home"); } : undefined} /></MembershipProvider>);
  if (!dataReady) return withLanguage(<div className="fatal-state">Study data could not be loaded.</div>);
  return withLanguage(<MembershipProvider userId={user.id}><div className={cn("app-shell active-interface",sidebarCollapsed&&"sidebar-collapsed")}><a className="skip-link" href="#main-content" onClick={(e) => { e.preventDefault(); document.getElementById("main-content")?.focus(); }}>{"跳至主要内容"}</a><Sidebar collapsed={sidebarCollapsed} toggleCollapsed={toggleSidebar} focusTimer={focusTimer} page={navigationPage} navigate={navigate} dark={dark} toggleDark={toggleDark} language={language} mistakeCount={Object.keys(mistakes).length} /><div className="app-main"><Topbar user={user} onSelectQuestion={openPaper} language={language} setLanguage={setLanguage} submitSearch={submitSearch} page={page} /><div className="account-bar"><MembershipStatus/><LearningTour key={user.id} userId={user.id} page={editingProfile?'profile':page} language={language} navigate={navigate}/>{user.avatarUrl && <img className="account-avatar" src={user.avatarUrl} alt="我的头像" />}<span>{user.role === "admin" ? "开发者" : user.nickname || user.email}</span>{user.role === "student" && <button data-tour="profile-settings" className="account-settings" disabled={saving} onClick={() => setEditingProfile(true)}><Settings aria-hidden="true" />个人设置</button>}{saving && <span role="status">正在保存…</span>}{user.role === "admin" && <button onClick={() => navigate("admin")}>统计后台</button>}{user.role === "admin" && <button disabled={saving} onClick={logout}>退出登录</button>}</div><main data-tour="page-root" data-tour-page={editingProfile?'profile':page} id="main-content" tabIndex={-1} className="content" ref={pageMotion} data-motion-surface="page">{editingProfile ? <ProfileView embedded logoutError={syncError} user={user} language={language} onSaved={next=>{setUser(next);setEditingProfile(false);}} onLogout={logout} onCancel={()=>setEditingProfile(false)}/> : <><PomodoroView timer={focusTimer} language={language} visible={page === "focus"} />{syncError && <p className="account-error" role="alert">{syncError}</p>}{legacy.length > 0 && user.role === 'student' && <div className="import-banner"><span>此浏览器有 {legacy.length} 道旧错题。确认属于自己后，可导入目前账号。</span><Button disabled={saving} onClick={importLegacy}>导入我的错题</Button><Button variant="ghost" onClick={() => setLegacy([])}>稍后处理</Button></div>}<StudyPages page={page} navigate={navigate} user={user} askTarget={askTarget} language={language} openPaper={openPaper} openKnowledge={openKnowledge} mastered={mastered} mistakes={mistakes} openExercise={openExercise} exerciseBook={exerciseBook} exerciseTarget={exerciseTarget} saving={saving} setProgress={setProgress} setMistake={setMistake} paperDirectoryVersion={paperDirectoryVersion} paperTarget={paperTarget} clearPaperTarget={clearPaperTarget} paperQuery={paperQuery} rememberQuestion={rememberQuestion} knowledgeTarget={knowledgeTarget} clearKnowledgeTarget={clearKnowledgeTarget} bankQuery={bankQuery} saveMistakes={saveMistakes}/></>}</main></div><FocusCountdown mobile timer={focusTimer} language={language} onOpen={() => navigate("focus")} /><MobileNavigation page={navigationPage} language={language} navigate={navigate}/></div></MembershipProvider>);
}
