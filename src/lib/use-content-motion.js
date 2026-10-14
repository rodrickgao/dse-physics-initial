import { useLayoutEffect, useRef } from 'react';
const motions = new WeakMap();

// Keep the existing DOM mounted, preserving focus and input state.
export function useContentMotion(ref, key, scope = '', { initial = false, ready = true } = {}) {
  const previous = useRef(null);
  const interrupted = useRef(null);
  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = { key, scope, ready };
    if (!ready || !ref.current || (!old && !initial)) return;
    if (old && ((old.key === key && old.ready) || old.scope !== scope)) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const element = ref.current;
    if (document.documentElement.dataset.tourActive || reduced.matches || !element.animate) return;
    // A child inherits the parent reveal, so it does not need a second fade.
    if (element.parentElement?.closest('[data-motion-active]')) return;
    for (const child of element.querySelectorAll('[data-motion-active]')) {
      motions.get(child)?.cancel(); motions.delete(child); delete child.dataset.motionActive;
    }
    const opacity = interrupted.current?.element === element ? interrupted.current.opacity : .55;
    interrupted.current = null;
    element.dataset.motionActive = 'true';
    const animation = element.animate(
      [{ opacity }, { opacity: 1 }],
      { duration: 200, easing: 'cubic-bezier(.22,1,.36,1)' },
    );
    motions.set(element, animation);
    const finish = () => { if (motions.get(element) === animation) { motions.delete(element); delete element.dataset.motionActive; } };
    animation.addEventListener('finish', finish, { once: true });
    const stop = () => { if (reduced.matches) { animation.cancel(); finish(); } };
    reduced.addEventListener('change', stop);
    return () => {
      if (animation.playState === 'running') interrupted.current = { element, opacity: Number(getComputedStyle(element).opacity) };
      animation.cancel(); finish(); reduced.removeEventListener('change', stop);
    };
  }, [ref, key, scope, initial, ready]);
}
