const memory = new Map();
const prefix = 'dse-draft-v1:';
export function readDraft(key, fallback = '') {
  try { const saved = sessionStorage.getItem(prefix + key); if (saved !== null) return JSON.parse(saved); } catch { /* Keep drafts in memory when storage is unavailable. */ }
  return memory.has(key) ? memory.get(key) : fallback;
}
export function writeDraft(key, value) {
  memory.set(key, value);
  try { sessionStorage.setItem(prefix + key, JSON.stringify(value)); } catch { /* In-memory fallback. */ }
}
export function clearDraft(key) {
  memory.delete(key);
  try { sessionStorage.removeItem(prefix + key); } catch { /* Storage may be unavailable. */ }
}
