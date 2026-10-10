import { useEffect, useRef, useState } from 'react';
import { Atom, ChevronRight, Search } from 'lucide-react';
import { DseCountdown } from '../DseCountdown';
import { QuestionSuggestions } from '../QuestionSuggestions';

export function Topbar({ user, language, setLanguage, submitSearch, page, onSelectQuestion }) {
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
