import { useEffect, useState } from 'react';
import { questionLabelFromKey } from '../lib/data';
import './question-suggestions.css';
import { track } from '../lib/activity';
import { useMembership } from './Membership';

export function QuestionSuggestions({ query, language, onSelect }) {
  const membership=useMembership();
  const [state, setState] = useState(null);
  useEffect(() => { if (!query.trim()) return; const timer = setTimeout(() => track('search', query), 1000); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const [loader, engine] = await Promise.all([import('../lib/question-search-loader'), import('../lib/question-search')]);
        const index = await loader.loadUnifiedQuestionSearch(language);
        const results = engine.rankQuestionEntries(index, query).slice(0, 8);
        if (!cancelled) setState({ query, language, results });
      } catch { if (!cancelled) setState({ query, language, error: true }); }
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, language, membership.revision]);
  if (!query.trim()) return null;
  const ready = state?.query === query && state?.language === language;
  return <div className="global-question-results" aria-label={'题目建议'}>
    {!ready ? <p role="status">{language==='eng'?'Searching…':'正在搜索…'}</p>
      : state.error ? <p>{language==='eng'?'Press Enter to open search and try again.':'请按 Enter 打开搜索并重试。'}</p>
      : state.results.length ? state.results.map(entry => <button type="button" key={entry.key} onClick={() => onSelect(entry.key)}><strong>{entry.source === 'textbook' ? (language === 'eng' ? 'Textbook · ' : '课本习题 · ') : ''}{questionLabelFromKey(entry.key)}</strong><small>{entry.excerpt}</small></button>)
      : <p>{'找不到相符题目。'}</p>}
  </div>;
}
