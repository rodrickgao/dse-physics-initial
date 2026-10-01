import { observeReadingFocus } from './reading-focus';
import { track } from './activity';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { readSaved, writeSaved } from './study-state';
import { focusRemaining, settleFocus, formatFocusTime } from './focus-timer';

const fresh = (minutes = 30, records = {}) => ({ minutes, remaining: minutes * 60000, endsAt: null, id: crypto.randomUUID(), records });
function restore(userId) {
  const saved = readSaved(`dse-focus-v1-${userId}`, null);
  if (!saved || !Number.isInteger(saved.minutes) || saved.minutes < 30 || saved.minutes > 180 || !Number.isFinite(saved.remaining) || saved.remaining < 0 || saved.remaining > saved.minutes * 60000 || !(saved.endsAt === null || Number.isFinite(saved.endsAt))) return fresh();
  return { ...saved, id: saved.id || crypto.randomUUID(), records: saved.records || {} };
}

export function useFocusTimer(userId) {
  const [view, setView] = useState(null);
  const current = useRef(null);
  const [syncError, setSyncError] = useState('');
  useEffect(() => {
    setSyncError('');
    if (!userId) { current.current = null; setView(null); return; }
    let alive = true, busy = false;
    const key = `dse-focus-v1-${userId}`;
    const manualKey = `dse-focus-manual-v1-${userId}`;
    current.current = { userId, session: settleFocus(restore(userId), Date.now()) };
    if (current.current.session.endsAt > Date.now()) writeSaved(manualKey, {id:current.current.session.id,endsAt:current.current.session.endsAt});
    function publish() {
      if (!alive) return;
      const stored = readSaved(key, null)?.records || {};
      const records = { ...current.current.session.records };
      for (const [id, ms] of Object.entries(stored)) if (Number.isSafeInteger(ms) && ms >= 0 && ms <= 10800000) records[id] = Math.max(records[id] || 0, ms);
      const session = settleFocus({...current.current.session, records}, Date.now());
      current.current = { ...current.current, userId, session };
      writeSaved(key, session);
      setView({ userId, session, now: Date.now() });
    }
    async function sync() {
      if (!alive || busy) return;
      busy = true; publish();
      try {
        const entries = Object.entries(current.current.session.records);
        // Bound request size for long-running accounts.
        let result;
        if (!entries.length) result = await api('focus');
        for (let offset = 0; offset < entries.length; offset += 200) {
          result = await api('focus', { sessions: entries.slice(offset, offset + 200).map(([id, elapsedMs]) => ({ id, elapsedMs })) }, 'PUT');
          if (!alive) return;
        }
        if (!alive) return;
        const records = { ...current.current.session.records };
        for (const item of result.sessions) records[item.id] = Math.max(records[item.id] || 0, item.elapsedMs);
        current.current.session = { ...current.current.session, records };
        setSyncError(''); publish();
      } catch { if (alive) setSyncError('专注记录已暂存于此装置，连线恢复后会自动同步。'); }
      finally { busy = false; }
    }
    current.current.sync = sync;
    // Keep actions available after each clock update.
    const tick = () => { publish(); current.current.sync = sync; };
    tick();
    const reading = observeReadingFocus({
      save: (id, elapsedMs) => {
        if (!alive || current.current?.userId !== userId) return;
        const stored = readSaved(key, null)?.records || {};
        for (const [otherId, ms] of Object.entries(stored)) if (Number.isSafeInteger(ms) && ms >= 0 && ms <= 10800000) current.current.session.records[otherId] = Math.max(current.current.session.records[otherId] || 0, ms);
        current.current.session.records[id] = Math.max(current.current.session.records[id] || 0, elapsedMs);
        writeSaved(key, current.current.session);
      },
      manualRunning: () => {
        const session = current.current.session;
        return (session.endsAt !== null && focusRemaining(session, Date.now()) > 0) || readSaved(manualKey, null)?.endsAt > Date.now();
      },
    });
    current.current.reading = reading;
    void sync();
    const leaving = () => {
      reading.stop(); publish();
      const sessions = Object.entries(current.current.session.records).slice(-200).map(([id,elapsedMs])=>({id,elapsedMs}));
      if (sessions.length) void fetch('/api/focus', {method:'PUT',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({sessions})}).catch(()=>{});
    };
    window.addEventListener('pagehide', leaving);
    const timer = setInterval(tick, 1000);
    const syncTimer = setInterval(sync, 15000);
    const wake = () => { tick(); reading.sample(); void sync(); };
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => { reading.dispose(); window.removeEventListener('pagehide', leaving); publish(); alive = false; clearInterval(timer); clearInterval(syncTimer); window.removeEventListener('focus', wake); window.removeEventListener('online', wake); document.removeEventListener('visibilitychange', wake); };
  }, [userId]);
  function change(action, minutes) {
    if (!current.current || current.current.userId !== userId) return;
    track(`focus_${action}`, String(minutes ?? current.current.session.minutes));
    const {sync, reading} = current.current;
    reading?.stop();
    const now = Date.now();
    let session = settleFocus(current.current.session, now);
    const remaining = focusRemaining(session, now);
    if (action === 'start') {
      if (!remaining) session = fresh(session.minutes, session.records);
      session = { ...session, endsAt: now + session.remaining };
    } else if (action === 'pause') session = { ...session, remaining, endsAt: null };
    else session = fresh(minutes ?? session.minutes, session.records);
    const manualKey = `dse-focus-manual-v1-${userId}`;
    if (session.endsAt > now) writeSaved(manualKey, {id:session.id,endsAt:session.endsAt});
    else if (readSaved(manualKey, null)?.id === current.current.session.id) writeSaved(manualKey, null);
    current.current = { userId, session, sync, reading };
    reading?.sample();
    writeSaved(`dse-focus-v1-${userId}`, session);
    setView({ userId, session, now });
    void sync?.();
  }
  if (!view || view.userId !== userId) return null;
  const remaining = focusRemaining(view.session, view.now);
  return { session: view.session, remaining, running: view.session.endsAt !== null && remaining > 0, time: formatFocusTime(remaining), totalMs: Object.values(view.session.records).reduce((sum, value) => sum + value, 0), syncError, start: () => change('start'), pause: () => change('pause'), reset: minutes => change('reset', minutes) };
}
