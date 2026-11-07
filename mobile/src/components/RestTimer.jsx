import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { clock, COUNTDOWN_BEEPS } from '../lib/training.js';
import { feedback } from '../store/feedback.js';
import { useTimer } from '../store/useTimer.js';
import Icon from './Icon.jsx';
import { t } from '../lib/i18n.js';

// Quick lengths on the full screen timer.
const PRESETS = [45, 60, 90, 120, 180];
const RING_R = 120;
const RING_C = 2 * Math.PI * RING_R;

/** The rest timer: a floating panel above the tab bar with big digits, a
 * progress bar and labelled controls (-15s, +15s, Pause/Resume, Skip), and a
 * full screen view (tap the time) with a ring and quick lengths. When the rest
 * is over it stays up with Restart and Close. Away from the workout
 * (`compact`) it is a small solid pill with the time and Skip (P14-16). */
export default function RestTimer({ compact = false }) {
  const navigate = useNavigate();
  const { endsAt, total, label, pausedLeft, add, pause, resume, skip, stop, start } = useTimer();
  const [now, setNow] = useState(Date.now());
  const [full, setFull] = useState(false);
  const beeped = useRef(null);
  const ringRef = useRef(null);
  const barRef = useRef(null);
  const paused = pausedLeft != null;

  // The ring and the bar move every frame, so they glide instead of jumping
  // in 200 ms steps. They're set on the elements directly: no React render
  // per frame, only the digits re-render (5 times a second, above).
  useEffect(() => {
    if (!endsAt || paused) return undefined;
    let raf = 0;
    const frame = () => {
      const f = total ? Math.min(1, Math.max(0, endsAt - Date.now()) / (total * 1000)) : 0;
      if (ringRef.current) ringRef.current.style.strokeDashoffset = String(RING_C * (1 - f));
      if (barRef.current) barRef.current.style.transform = `scaleX(${f})`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [endsAt, paused, total]);

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
      feedback('restDone', { inShade: useTimer.getState().inShade });
    }
  }, [endsAt, left, paused]);

  if (!endsAt) return null;
  const done = left === 0 && !paused;
  const fraction = total ? Math.min(1, leftMs / (total * 1000)) : 0;
  const restart = (sec = total) => start(sec, label);

  const controls = done ? (
    <div className="timer-ctl">
      <button type="button" className="tbtn" onClick={() => restart()}><Icon name="timer" /><span>Restart {clock(total)}</span></button>
      <button type="button" className="tbtn go" onClick={stop}><Icon name="check" /><span>Done</span></button>
    </div>
  ) : (
    <div className="timer-ctl">
      <button type="button" className="tbtn" onClick={() => add(-15)} aria-label="15 seconds less"><b>−15</b><span>sec</span></button>
      <button type="button" className="tbtn" onClick={() => add(15)} aria-label="15 seconds more"><b>+15</b><span>sec</span></button>
      <button type="button" className="tbtn" onClick={paused ? resume : pause} aria-label={paused ? 'Start the rest again' : 'Pause the rest'}>
        <Icon name={paused ? 'play' : 'pause'} /><span>{paused ? 'Start' : 'Pause'}</span>
      </button>
      <button type="button" className="tbtn" onClick={skip} aria-label="Skip the rest"><Icon name="skip" /><span>Skip</span></button>
    </div>
  );

  if (compact && !full) {
    return (
      <div className={`timer-pill${done ? ' done' : ''}`} role="timer" aria-live="off">
        <span className="sr-only" role="status">{done ? t('timer.over', { label }) : ''}</span>
        <button type="button" className="pill-open" onClick={() => navigate('/workout')} aria-label={t('pill.open')}>
          <Icon name="timer" />
          <span className="t">{done ? t('pill.go') : clock(left)}</span>
          <span className="pill-what">{done ? t('pill.done') : paused ? t('pill.paused') : t('pill.rest')}</span>
        </button>
        {done
          ? <button type="button" className="pill-btn" onClick={stop}>{t('pill.close')}</button>
          : <button type="button" className="pill-btn" onClick={skip}>{t('pill.skip')}</button>}
      </div>
    );
  }

  if (full) {
    return (
      <div className="timer-full" role="timer" aria-live="off">
        <span className="sr-only" role="status">{done ? t('timer.over', { label }) : ''}</span>
        <button type="button" className="icon-btn timer-close" aria-label="Back to the workout" onClick={() => setFull(false)}><Icon name="chev" /></button>
        <div className="muted">{done ? 'Rest done' : paused ? 'Paused' : 'Rest'}</div>
        <svg viewBox="0 0 280 280" className="ring" aria-hidden="true">
          <circle cx="140" cy="140" r={RING_R} fill="none" stroke="var(--surface2)" strokeWidth="14" />
          <circle ref={ringRef} className="ring-fill" cx="140" cy="140" r={RING_R} fill="none" stroke="var(--accent)" strokeWidth="14" strokeLinecap="round"
            strokeDasharray={RING_C} style={{ strokeDashoffset: RING_C * (1 - fraction) }} transform="rotate(-90 140 140)" />
          <text x="140" y="160" textAnchor="middle" className="ring-t">{done ? 'Go' : clock(left)}</text>
        </svg>
        <div className="big-next">Next: {label}</div>
        {controls}
        <div className="timer-presets" role="group" aria-label="Start a new rest">
          {PRESETS.map((sec) => (
            <button key={sec} type="button" className={`tpre${sec === total ? ' on' : ''}`} onClick={() => restart(sec)}>{clock(sec)}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`timer${done ? ' done' : ''}`} role="timer" aria-live="off">
      <span className="sr-only" role="status">{done ? t('timer.over', { label }) : ''}</span>
      <button type="button" className="timer-open" onClick={() => setFull(true)} aria-label="Open the full screen timer">
        <div className="t">{done ? 'Go' : clock(left)}</div>
        <div className="grow">
          <div className="timer-what">{done ? 'Rest done' : paused ? 'Paused' : 'Rest'}</div>
          <div className="muted small">Next: {label}</div>
        </div>
        <Icon name="chev" className="icon timer-expand" />
      </button>
      <div className="timer-bar" aria-hidden="true"><i ref={barRef} style={{ transform: `scaleX(${fraction})` }} /></div>
      {controls}
    </div>
  );
}
