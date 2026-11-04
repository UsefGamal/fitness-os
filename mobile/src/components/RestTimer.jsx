import { useEffect, useRef, useState } from 'react';

import { clock, COUNTDOWN_BEEPS } from '../lib/training.js';
import { feedback } from '../store/feedback.js';
import { useTimer } from '../store/useTimer.js';
import Icon from './Icon.jsx';

/** The rest timer: a floating bar above the tab bar, and a full screen
 * view (tap the time) with big digits and a progress ring. */
export default function RestTimer() {
  const { endsAt, total, label, pausedLeft, add, pause, resume, skip, stop } = useTimer();
  const [now, setNow] = useState(Date.now());
  const [full, setFull] = useState(false);
  const beeped = useRef(null);
  const paused = pausedLeft != null;

  useEffect(() => {
    if (!endsAt || paused) return undefined;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [endsAt, paused]);

  const leftMs = paused ? pausedLeft : endsAt ? Math.max(0, endsAt - now) : 0;
  const left = Math.ceil(leftMs / 1000);

  // 3-2-1 beeps, then the done sound once.
  useEffect(() => {
    if (!endsAt || paused) return;
    const key = `${endsAt}:${left}`;
    if (beeped.current === key) return;
    if (COUNTDOWN_BEEPS.includes(left)) {
      beeped.current = key;
      feedback('countdown');
    } else if (left === 0) {
      beeped.current = key;
      feedback('restDone');
      setFull(false);
    }
  }, [endsAt, left, paused]);

  if (!endsAt) return null;
  const done = left === 0 && !paused;
  const fraction = total ? Math.min(1, leftMs / (total * 1000)) : 0;

  const buttons = (
    <>
      <button type="button" className="btn small secondary" onClick={() => add(-15)} disabled={done} aria-label="15 seconds less">-15</button>
      <button type="button" className="btn small secondary" onClick={() => add(15)} aria-label="15 seconds more">+15</button>
      {done ? null : (
        <button type="button" className="icon-btn" aria-label={paused ? 'Resume timer' : 'Pause timer'} onClick={paused ? resume : pause}>
          <Icon name={paused ? 'play' : 'pause'} />
        </button>
      )}
      <button type="button" className="icon-btn" aria-label={done ? 'Close timer' : 'Skip rest'} onClick={done ? stop : skip}>
        <Icon name={done ? 'x' : 'skip'} />
      </button>
    </>
  );

  if (full) {
    const R = 120;
    const C = 2 * Math.PI * R;
    return (
      <div className="timer-full" role="timer" aria-live="polite">
        <button type="button" className="icon-btn timer-close" aria-label="Back to the workout" onClick={() => setFull(false)}><Icon name="chev" /></button>
        <div className="muted">{paused ? 'Paused' : 'Rest'}</div>
        <svg viewBox="0 0 280 280" className="ring" aria-hidden="true">
          <circle cx="140" cy="140" r={R} fill="none" stroke="var(--surface2)" strokeWidth="14" />
          <circle cx="140" cy="140" r={R} fill="none" stroke="var(--accent)" strokeWidth="14" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - fraction)} transform="rotate(-90 140 140)" />
          <text x="140" y="160" textAnchor="middle" className="ring-t">{clock(left)}</text>
        </svg>
        <div className="big-next">Next: {label}</div>
        <div className="row" style={{ justifyContent: 'center', gap: 12 }}>{buttons}</div>
      </div>
    );
  }

  return (
    <div className={`timer${done ? ' done' : ''}`} role="timer" aria-live="polite">
      <button type="button" className="timer-open" onClick={() => setFull(true)} aria-label="Open the full screen timer">
        <Icon name="timer" />
        <div className="grow" style={{ textAlign: 'left' }}>
          <div className="t">{done ? 'Go' : clock(left)}</div>
          <div className="muted small">{done ? `Next set: ${label}` : paused ? `Paused · then ${label}` : `Rest · then ${label}`}</div>
        </div>
      </button>
      {buttons}
    </div>
  );
}
