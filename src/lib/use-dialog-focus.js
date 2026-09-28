import { useEffect } from 'react';

export function useDialogFocus(ref, open, onClose, busy = false) {
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')];
    (controls()[0] || dialog).focus();
    const handle = event => {
      if (event.key === 'Escape') { event.preventDefault(); if (!busy) onClose(); }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0] || dialog, last = items.at(-1) || dialog;
      if (!items.length || (event.shiftKey && (document.activeElement === first || document.activeElement === dialog))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [ref, open, onClose, busy]);
}
