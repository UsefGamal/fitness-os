import { useEffect, useRef, useState } from 'react';

import { feedback } from '../store/feedback.js';

const PULL_AT = 72; // px of pull that starts a refresh

/**
 * MOVE-1, pull to refresh: at the top of the page, pulling down draws a ring
 * that fills; let go past the line and `onRefresh` runs (Stats: read new
 * weigh-ins, steps and sleep from Health Connect). Off when `enabled` is
 * false, so it never pretends to refresh something it can't.
 */
export default function PullRefresh({ onRefresh, enabled, label }) {
  const box = useRef(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let y0 = null;
    let pull = 0;
    const set = (v) => { pull = v; box.current?.style.setProperty('--pull', String(v)); };
    const start = (e) => { y0 = window.scrollY <= 0 && !busy ? e.touches[0].clientY : null; };
    const move = (e) => {
      if (y0 == null) return;
      const d = e.touches[0].clientY - y0;
      set(d > 0 ? Math.min(110, d * 0.55) : 0);
    };
    const end = async () => {
      if (y0 == null) return;
      y0 = null;
      if (pull >= PULL_AT) {
        feedback('tap');
        setBusy(true);
        try { await onRefresh(); } finally { setBusy(false); }
      }
      set(0);
    };
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: true });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);
    return () => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', end);
    };
  }, [enabled, onRefresh, busy]);
  if (!enabled) return null;
  return (
    <div ref={box} className={`ptr${busy ? ' busy' : ''}`} role="status" aria-live="polite">
      <svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="12" /></svg>
      {busy ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}
