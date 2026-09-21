import { useEffect, useRef, useState } from 'react';
import './teacher-float.css';

const POSITION_KEY = 'dse-physics-teacher-position-v1';
function bounds() {
  const width = window.innerWidth;
  const height = Math.min(window.innerHeight, window.visualViewport?.height || window.innerHeight);
  const nav = document.querySelector('.mobile-nav')?.getBoundingClientRect();
  const bottom = nav?.height ? Math.min(height, nav.top) : height;
  return { minX: 12, minY: 12, maxX: Math.max(12, width - 76), maxY: Math.max(12, bottom - 88) };
}
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
function restorePosition() {
  const b = bounds();
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY));
    if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return { x: b.minX + clamp(saved.x, 0, 1) * (b.maxX - b.minX), y: b.minY + clamp(saved.y, 0, 1) * (b.maxY - b.minY) };
  } catch { /* Default position remains available. */ }
  return { x: b.maxX, y: b.maxY };
}
function savePosition(position) {
  const b = bounds();
  try { localStorage.setItem(POSITION_KEY, JSON.stringify({ x: (position.x - b.minX) / Math.max(1, b.maxX - b.minX), y: (position.y - b.minY) / Math.max(1, b.maxY - b.minY) })); } catch { /* Session-only position. */ }
}

export function TeacherFloat({ language, visible, onOpen }) {
  const [position, setPosition] = useState(restorePosition);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  useEffect(() => {
    if (!visible) return;
    const resize = () => setPosition(restorePosition());
    resize(); window.addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); };
  }, [visible]);
  if (!visible) return null;
  const en = language === 'eng';
  const move = event => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = event.clientX - state.startX, dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < 6) return;
    state.moved = true; setDragging(true);
    const b = bounds();
    state.position = { x: clamp(state.origin.x + dx, b.minX, b.maxX), y: clamp(state.origin.y + dy, b.minY, b.maxY) };
    setPosition(state.position);
  };
  return <button type="button" className="teacher-float" data-dragging={dragging} style={{ left: position.x, top: position.y }}
    aria-label={en ? 'Ask a teacher' : '问老师'} title={en ? 'Ask a teacher · Drag to move' : '问老师 · 可拖动'}
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return;
      drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, origin: position, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={move}
    onPointerUp={event => {
      const state = drag.current;
      if (!state || state.id !== event.pointerId) return;
      if (state.moved) savePosition(state.position);
      drag.current = null; setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (!state.moved) onOpen();
    }} onPointerCancel={() => { drag.current = null; setDragging(false); }}
    onClick={event => { if (event.detail === 0) onOpen(); }}>
    <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 6h16v19H22M22 11h6M22 16h4M26 25v5M23 30h6" />
      <circle cx="10" cy="11" r="4" />
      <path d="M4 30v-7a6 6 0 0 1 12 0v7M16 22l6-5M8 30v-6M12 30v-6" />
    </svg><span>{en ? 'Teacher' : '问老师'}</span>
  </button>;
}
