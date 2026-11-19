import { useRef, useState } from 'react';

import { feedback } from '../store/feedback.js';

/** A toast at the bottom (MOVE-2): swipe it sideways to send it away, and
 * with `ms` a thin bar shows how long it stays (the Undo window). Only one
 * shows at a time; screens queue the next one until this one is gone. */
export default function Toast({ className = '', role, hidden = false, ms, onDismiss, children }) {
  const [dx, setDx] = useState(0);
  const g = useRef(null);
  const down = (e) => {
    if (!onDismiss || e.target.closest('button')) return;
    g.current = { x: e.clientX, t: e.timeStamp };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => { if (g.current) setDx(e.clientX - g.current.x); };
  const up = (e) => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    const fast = Math.abs(dx) > 24 && Math.abs(dx) / Math.max(1, e.timeStamp - s.t) > 0.5;
    if (Math.abs(dx) > 72 || fast) { feedback('tap'); onDismiss(); }
    setDx(0);
  };
  return (
    <div className={`toast${className ? ` ${className}` : ''}`} role={role} aria-hidden={hidden || undefined}
      style={dx ? { transform: `translateX(${dx}px)`, opacity: Math.max(0.2, 1 - Math.abs(dx) / 200), transition: 'none' } : undefined}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {children}
      {ms ? <span className="toast-timer" style={{ '--ms': `${ms}ms` }} aria-hidden="true" /> : null}
    </div>
  );
}
