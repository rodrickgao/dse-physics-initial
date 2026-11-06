import { useContentMotion } from '../lib/use-content-motion';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, CheckCheck, ChevronRight, FileText, MoveRight, Printer, RotateCcw, X } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { landingExample } from '../data/landing-example';

const TAB_IDS = ['learn', 'practise', 'review'];

function QuestionContent({ english, statementOnly = false }) {
  const example = landingExample[english ? 'eng' : 'chn'];
  return <div className="demo-real-question" data-source-question={landingExample.id} dangerouslySetInnerHTML={{ __html: statementOnly ? example.statement : example.question }}/>;
}

export function PrintPreview({ english, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);
  return <dialog ref={dialog} className="landing-print-dialog" aria-labelledby="print-demo-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="print-demo-toolbar"><h2 id="print-demo-title">{english ? 'Worksheet preview' : '错题打印预览'}</h2><button type="button" onClick={onClose} aria-label={english ? 'Close preview' : '关闭预览'} autoFocus><X/></button></div>
    <div className="demo-paper"><div className="demo-paper-heading"><BrandLogo language={english ? 'eng' : 'chn'}/><span>{english ? 'Mistake notebook' : '我的错题本'}</span></div><span className="demo-paper-watermark" aria-hidden="true">高多多物理 ddphysics</span><h3>{english ? '[Past paper]' : '[真题]'} · {landingExample.label}</h3><QuestionContent english={english}/><div className="demo-paper-space"/><span className="demo-paper-page">01</span></div>
  </dialog>;
}

export function ProductPreview({ english, initialTab = 'practise', initialStatus = null, initialAnswer = false }) {
  const [tab, setTab] = useState(initialTab);
  const [status, setStatus] = useState(() => { try { return typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('ddphysics-preview-2025-q28')) ?? initialStatus : initialStatus; } catch { return initialStatus; } });
  useEffect(() => { try { localStorage.setItem('ddphysics-preview-2025-q28', JSON.stringify(status)); } catch {} }, [status]);
  const [answer, setAnswer] = useState(initialAnswer);
  const [print, setPrint] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const panel = useRef(null);
  const tabs = useRef([]);
  const example = landingExample[english ? 'eng' : 'chn'];
  const labels = english ? ['Learn', 'Practise', 'Review mistakes'] : ['学知识', '做练习', '复习错题'];
  useContentMotion(panel, tab);
  useEffect(() => { setAnnouncement(''); }, [english]);
  function selectTab(next) { setTab(next); setAnnouncement(''); }
  function changeStatus(next) {
    const value = status === next ? null : next;
    setStatus(value);
    setAnnouncement(value === 'mastered' ? (english ? 'Marked as mastered. Removed from the demo notebook.' : '已标记掌握，已从演示错题本移除。') : value === 'wrong' ? (english ? 'Added to the demo notebook.' : '已加入演示错题本。') : (english ? 'Mark removed.' : '已取消标记。'));
  }
  function reset() { setTab('practise'); setStatus(null); setAnswer(false); setAnnouncement(english ? 'Demo reset.' : '演示已重置。'); }
  return <div className="product-preview" id="feature-preview">
    <div className="preview-chrome"><div className="preview-window-dots" aria-hidden="true"><i/><i/><i/></div><span>DDPhysics</span><span className="preview-example-tag">{english ? 'Demo' : '体验'}</span></div>
    <div className="preview-body">
      <aside className="preview-sidebar" aria-label={english ? 'Study tools' : '学习工具'}>
        <BrandLogo language="eng"/>
        <div role="tablist" aria-label={english ? 'Explore DDPhysics' : '体验 DDPhysics'} aria-orientation="vertical">
          {TAB_IDS.map((id, index) => {
            const Icon = [BookOpen, FileText, CheckCheck][index];
            return <button ref={element => { tabs.current[index] = element; }} type="button" key={id} id={'demo-tab-' + id} role="tab" aria-controls={'demo-panel-' + id} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => selectTab(id)} onKeyDown={event => {
              if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1) + 3) % 3;
              selectTab(TAB_IDS[next]); tabs.current[next]?.focus();
            }}><Icon/><span>{labels[index]}</span>{id === 'review' && status === 'wrong' && <em>1</em>}</button>;
          })}
        </div>
      </aside>
      <div className="preview-main">
        <div className="preview-page-heading"><div><span>{landingExample.label}</span><h3>{tab === 'review' ? (english ? 'Mistake notebook' : '我的错题本') : example.title}</h3></div><button className="preview-reset" type="button" onClick={reset} aria-label={english ? 'Reset demo' : '重置演示'}><RotateCcw/></button></div>
        <section ref={panel} className="preview-panel" id={'demo-panel-' + tab} role="tabpanel" tabIndex={0} aria-labelledby={'demo-tab-' + tab}>
          {(tab === 'learn' || tab === 'practise') && <div className="demo-practise">
            <div className="demo-card-label"><span>28</span>{english ? 'Original question' : '原题'}</div>
            <QuestionContent english={english}/>
            {example.sourceNote && <p className="demo-source-note">{example.sourceNote}</p>}
            <details className="demo-reader-section" data-reader="official"><summary>{english ? 'Official answer' : '官方答案'}<ChevronRight/></summary><div dangerouslySetInnerHTML={{ __html: example.official }}/></details>
            <details className="demo-reader-section" data-reader="reasoning"><summary>{english ? 'Detailed explanation' : '详细解答'}<ChevronRight/></summary><div dangerouslySetInnerHTML={{ __html: example.reasoning }}/></details>
            <div className="demo-related-knowledge"><h4>{english ? 'Related knowledge' : '关联知识点'}</h4><div>{landingExample.knowledgeLabels.map(label => <span key={label}>{label}</span>)}</div></div>
            <div className="demo-progress-buttons"><button type="button" aria-pressed={status === 'mastered'} className={status === 'mastered' ? 'is-mastered' : ''} onClick={() => changeStatus('mastered')}><Check/><span>{status === 'mastered' ? (english ? 'Mastered' : '已掌握') : (english ? 'Mark as mastered' : '标记掌握')}</span></button><button type="button" aria-pressed={status === 'wrong'} className={status === 'wrong' ? 'is-saved' : ''} onClick={() => changeStatus('wrong')}><BookOpen/><span>{status === 'wrong' ? (english ? 'In mistake notebook' : '已加入错题') : (english ? 'Add to mistakes' : '加入错题')}</span></button></div>
          </div>}
          {tab === 'review' && <div className="demo-review">
            <div className="demo-review-summary"><span><BookOpen/>{english ? 'Saved questions' : '收藏的错题'}</span><strong>{status === 'wrong' ? '01' : '00'}<small>{english ? 'to review' : '待复习'}</small></strong></div>
            {status === 'wrong' ? <><div className="demo-saved-question"><span className="demo-saved-icon"><FileText/></span><div><span>{landingExample.label}</span><strong>{example.title}</strong><small>2025 · Q28</small></div><button type="button" onClick={() => selectTab('practise')} aria-label={english ? 'Review this question' : '复习这道题'}><ArrowRight/></button></div><div className="demo-review-actions"><button className="demo-next" type="button" onClick={() => setPrint(true)}><Printer/>{english ? 'Preview worksheet' : '打印预览'}</button><button className="demo-master-from-review" type="button" onClick={() => changeStatus('mastered')}><Check/>{english ? 'I’ve mastered this' : '这题我掌握了'}</button></div></> : <div className="demo-empty"><CheckCheck/><strong>{status === 'mastered' ? (english ? 'Nothing left to review.' : '这道题已经掌握。') : (english ? 'No saved questions.' : '还没有收藏错题。')}</strong><button type="button" className="demo-next" onClick={() => { setStatus('wrong'); setAnnouncement(english ? 'Question added.' : '已加入这道题。'); }}>{english ? 'Add the question again' : '重新加入这道题'}<ArrowRight/></button></div>}
          </div>}
        </section>
        <div className="preview-status" role="status" aria-live="polite">{announcement || (english ? 'Demo progress · no account needed' : '演示学习记录 · 无需注册')}</div>
      </div>
    </div>
    {print && <PrintPreview english={english} onClose={() => setPrint(false)}/>}
  </div>;
}

export function LandingPage({ language, onAuth }) {
  const english = language === 'eng';
  const page = useRef(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { threshold: .08 });
    page.current.querySelectorAll('[data-landing-reveal]').forEach(element => { element.classList.add('will-reveal'); observer.observe(element); });
    return () => observer.disconnect();
  }, []);
  function jump(id) { document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
  return <div ref={page} className="landing-page landing-minimal" lang={english ? 'en' : 'zh-CN'}>
    <a className="landing-skip" href="#feature-preview">{english ? 'Skip to the interactive demo' : '跳到功能体验'}</a>
    <header className="landing-header"><div className="landing-header-inner">
      <a className="landing-brand" href="#" aria-label={english ? 'DDPhysics home' : '高多多物理首页'}><BrandLogo language={language}/></a>
      <nav aria-label={english ? 'Website navigation' : '网站导航'}><button type="button" onClick={() => jump('feature-preview')}>{english ? 'Explore DDPhysics' : '体验 DDPhysics'}</button><button type="button" onClick={() => jump('how-it-works')}>{english ? 'How it works' : '学习流程'}</button></nav>
      <div className="landing-header-actions"><button className="landing-login" type="button" onClick={() => onAuth('login')}>{english ? 'Log in' : '登录'}</button><button className="landing-button landing-button-small" type="button" onClick={() => onAuth('register')}>{english ? 'Get started' : '开始学习'}<ArrowRight/></button></div>
    </div></header>
    <main>
      <section className="landing-hero"><h1>物理五星星</h1><div className="landing-hero-actions"><button className="landing-button" type="button" onClick={() => onAuth('register')}>{english ? 'Start learning' : '开始学习'}<ArrowRight/></button></div></section>
      <section className="landing-preview-section" aria-label={english ? 'Explore the learning tools' : '体验学习工具'}><ProductPreview english={english}/></section>
      <section className="landing-workflow" id="how-it-works" aria-label={english ? 'Learning workflow' : '学习流程'} data-landing-reveal><div className="landing-workflow-grid">{[
        [BookOpen, english ? 'Learn' : '学知识'], [FileText, english ? 'Practise' : '做练习'], [CheckCheck, english ? 'Review' : '复习错题'],
      ].map(([Icon, title], index) => <article key={title}><div className="landing-step-top"><span><Icon/></span><small>0{index + 1}</small></div><h3>{title}</h3>{index < 2 && <MoveRight className="landing-step-arrow" aria-hidden="true"/>}</article>)}</div></section>
    </main>
    <footer className="landing-footer"><BrandLogo language="eng"/><span>© DDPhysics</span></footer>
  </div>;
}
