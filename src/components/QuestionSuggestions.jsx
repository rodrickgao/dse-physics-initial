import { useEffect, useState } from 'react';
import { questionLabelFromKey } from '../lib/data';
import './question-suggestions.css';
import { track } from '../lib/activity';

export function QuestionSuggestions({ query, language, onSelect }) {
  const [state, setState] = useState(null);
  useEffect(() => { if (!query.trim()) return; const timer = setTimeout(() => track('search', query), 1000); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const [loader, engine] = await Promise.all([import('../lib/question-search-loader'), import('../lib/question-search')]);
        const index = await loader.loadQuestionSearch(language);
        const results = engine.rankQuestionEntries(index, query).slice(0, 8);
        if (!cancelled) setState({ query, language, results });
      } catch { if (!cancelled) setState({ query, language, error: true }); }
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, language]);
  if (!query.trim()) return null;
  const ready = state?.query === query && state?.language === language;
  return <div className="global-question-results" aria-label={'题目建议'}>
    {!ready ? <p role="status">{'搜寻中…'}</p>
      : state.error ? <p>{'请按 Enter 开启搜寻并重试。'}</p>
      : state.results.length ? state.results.map(entry => <button type="button" key={entry.key} onClick={() => onSelect(entry.key)}><strong>{questionLabelFromKey(entry.key)}</strong><small>{entry.excerpt}</small></button>)
      : <p>{'找不到相符题目。'}</p>}
  </div>;
}
