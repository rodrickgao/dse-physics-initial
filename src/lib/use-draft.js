import { useState } from 'react';
import { readDraft, writeDraft, clearDraft } from './draft-store';

export function useDraft(key, fallback = '') {
  const [snapshot, setSnapshot] = useState(() => ({key, value: readDraft(key, fallback)}));
  const value = snapshot.key === key ? snapshot.value : readDraft(key, fallback);
  function update(next) {
    const result = typeof next === 'function' ? next(readDraft(key, fallback)) : next;
    writeDraft(key, result);
    setSnapshot({key, value: result});
  }
  function clear() { clearDraft(key); setSnapshot({key, value: fallback}); }
  return [value, update, clear];
}
