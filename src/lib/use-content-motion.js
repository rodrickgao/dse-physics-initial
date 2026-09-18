import { useLayoutEffect, useRef } from 'react';

// Keep the existing DOM mounted, preserving focus and input state.
export function useContentMotion(ref, key, scope = '') {
  const previous = useRef({ key, scope });
  useLayoutEffect(() => {
    const old = previous.current;
    previous.current = { key, scope };
    if (old.key === key || old.scope !== scope || !ref.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches || !ref.current.animate) return;
    const animation = ref.current.animate(
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' },
    );
    const stop = () => { if (reduced.matches) animation.cancel(); };
    reduced.addEventListener('change', stop);
    return () => { animation.cancel(); reduced.removeEventListener('change', stop); };
  }, [ref, key, scope]);
}
