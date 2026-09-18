export function focusRemaining(session, now) {
  return session.endsAt === null ? session.remaining : Math.max(0, Math.min(session.remaining, session.endsAt - now));
}

export function settleFocus(session, now) {
  const remaining = focusRemaining(session, now);
  const elapsed = Math.max(0, Math.round(session.minutes * 60000 - remaining));
  const records = { ...session.records };
  if (elapsed > 0) records[session.id] = Math.max(records[session.id] || 0, elapsed);
  return { ...session, records, ...(remaining === 0 ? { remaining: 0, endsAt: null } : {}) };
}

export function formatFocusTime(remaining) {
  const seconds = Math.ceil(remaining / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
