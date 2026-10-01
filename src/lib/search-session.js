export function readSearchSession(userId) {
  try { return JSON.parse(sessionStorage.getItem(`dse-search-return-${userId}`)) || null; } catch { return null; }
}
export function saveSearchSession(userId, value) {
  try { sessionStorage.setItem(`dse-search-return-${userId}`,JSON.stringify(value)); } catch { /* Search works without storage. */ }
}
