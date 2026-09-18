import { api } from './api';
let enabled = false;
let last = '';
let at = 0;
export function enableActivity(value) { enabled = value; if (!value) last = ''; }
export function track(action, target = '') {
  if (!enabled) return;
  const key = `${action}:${target}`;
  if (key === last && Date.now() - at < 1500) return;
  last = key; at = Date.now();
  void api('activity', { eventId: crypto.randomUUID(), action, target: String(target).slice(0,160) }).catch(() => {});
}
