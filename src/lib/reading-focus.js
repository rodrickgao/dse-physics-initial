// One uninterrupted, foreground visit must exceed one minute. Once qualified,
// its first minute counts too. Long gaps (sleep / throttling) end the visit.
export function createReadingFocus({ save, makeId = () => `reading-${Date.now()}-${crypto.randomUUID()}` }) {
  let visit = null;
  return {
    update(target, now) {
      if (visit) {
        const delta = now - visit.last;
        if (delta >= 0 && delta <= 5000) {
          visit.elapsed += delta;
          visit.last = now;
          if (visit.elapsed > 60000) save(visit.id, Math.min(10800000, Math.round(visit.elapsed)));
        } else visit = null;
      }
      if (!target || visit?.target !== target || visit.elapsed >= 10800000) {
        visit = target ? { target, id: makeId(), elapsed: 0, last: now } : null;
      }
    },
  };
}

// Choose exactly one visible card: the one covering the reading line, otherwise
// the card with the largest visible height. Lists and loading placeholders have no marker.
export function visibleReadingTarget(elements, width, height) {
  let best = null, bestScore = 0;
  const line = height * 0.4;
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.left >= width) continue;
    const visible = Math.min(height, rect.bottom) - Math.max(0, rect.top);
    if (visible < Math.min(80, rect.height * 0.5)) continue;
    const score = visible + (rect.top <= line && rect.bottom >= line ? height : 0);
    if (score > bestScore) { bestScore = score; best = element.getAttribute('data-focus-target'); }
  }
  return best;
}

export function observeReadingFocus({ save, manualRunning, document: doc = document, window: win = window }) {
  const tracker = createReadingFocus({ save });
  const sample = () => {
    const active = doc.visibilityState === 'visible' && doc.hasFocus() && !manualRunning();
    const target = active ? visibleReadingTarget(doc.querySelectorAll('[data-focus-target]'), win.innerWidth, win.innerHeight) : null;
    tracker.update(target, performance.now());
  };
  const stop = () => tracker.update(null, performance.now());
  const observer = new MutationObserver(sample);
  observer.observe(doc.body, {subtree:true, childList:true, attributes:true, attributeFilter:['data-focus-target','hidden','aria-busy']});
  const timer = win.setInterval(sample, 1000);
  doc.addEventListener('visibilitychange', sample);
  win.addEventListener('focus', sample);
  win.addEventListener('blur', stop);
  win.addEventListener('scroll', sample, true);
  win.addEventListener('resize', sample);
  win.addEventListener('pagehide', stop);
  sample();
  return { sample, stop, dispose() {
    stop(); observer.disconnect(); win.clearInterval(timer);
    doc.removeEventListener('visibilitychange', sample);
    win.removeEventListener('focus', sample); win.removeEventListener('blur', stop);
    win.removeEventListener('scroll', sample, true); win.removeEventListener('resize', sample);
    win.removeEventListener('pagehide', stop);
  }};
}
