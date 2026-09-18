const KEY = 'dse-remembered-emails-v1';
export function rememberedAccounts() {
  try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value.filter(email => typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).slice(0, 10) : []; } catch { return []; }
}
export function rememberAccount(user) {
  if (user?.role !== 'student') return;
  try { localStorage.setItem(KEY, JSON.stringify([user.email, ...rememberedAccounts().filter(email => email !== user.email)].slice(0, 10))); } catch { /* Storage may be disabled. */ }
}
export function forgetAccount(email) {
  const remaining = rememberedAccounts().filter(item => item !== email);
  try { localStorage.setItem(KEY, JSON.stringify(remaining)); } catch { /* Storage may be disabled. */ }
  return remaining;
}
