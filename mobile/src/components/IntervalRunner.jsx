import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import Icon from './Icon.jsx';
import { t } from '../lib/i18n.js';
import { intervalLines } from '../lib/intervals.js';
import { clock, COUNTDOWN_BEEPS } from '../lib/training.js';
import { useKeepAwake } from '../store/awake.js';
import { feedback } from '../store/feedback.js';
import { followShadeOff, onFollowShade, stepToShade } from '../store/followShade.js';
import { elapsedOf, positionOf, useIntervalRun } from '../store/intervalRun.js';

const SHADE_TEXTS = { rest: 'Intervals', done: 'Next round', nextSet: 'Open the app for the next round' };
const startOf = (steps, i) => steps.slice(0, Math.max(0, i)).reduce((n, s) => n + s.seconds, 0);

/** Keeps the interval run going on every page: the clock, the sounds, the
 * notification (move, countdown, Pause / Resume / Next), saving to History
 * when it ends, and a small pill back to the timer when you're elsewhere. */
export default function IntervalRunner() {
  const run = useIntervalRun((s) => s.run);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const last = useRef(null);
  const hadShade = useRef(false);
  const pos = run ? positionOf(run, now) : null;
  const done = Boolean(pos?.at.done);
  const running = Boolean(run) && !run.pausedAt && !done;
  useKeepAwake(Boolean(run) && !done);

  // The clock.
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [running]);

  // A new run starts its sounds from the top.
  useEffect(() => { last.current = null; }, [run?.startedAt]);

  // Sounds: a cue as each step starts, 3-2-1 before the next one, a finish
  // chime; and the run saves itself to History when it ends.
  useEffect(() => {
    if (!run || run.pausedAt) return;
    if (done) {
      if (last.current !== 'done') {
        last.current = 'done';
        feedback('workoutSaved');
        useIntervalRun.getState().save();
      }
      return;
    }
    const { steps, at } = pos;
    const key = `${at.index}:${at.left}`;
    if (last.current === key) return;
    const first = last.current === null || !last.current.startsWith(`${at.index}:`);
    last.current = key;
    if (first) feedback(steps[at.index].kind === 'work' ? 'work' : 'rest');
    else if (COUNTDOWN_BEEPS.includes(at.left)) feedback('countdown');
  });

  // The step now in the shade, sent again when it changes, pauses or jumps.
  const shadeKey = run && !done ? `${pos.at.index}:${run.pausedAt ? 'p' : 'r'}:${run.startedAt}:${run.pausedMs}` : null;
  useEffect(() => {
    if (!shadeKey) {
      if (hadShade.current) followShadeOff();
      hadShade.current = false;
      return;
    }
    hadShade.current = true;
    const { steps, at } = positionOf(run);
    const lines = intervalLines(steps, at.index, run.moves, { sets: run.config.sets });
    const leftMs = startOf(steps, at.index + 1) * 1000 - elapsedOf(run);
    stepToShade({ label: lines.title, detail: lines.detail, progress: run.config.label || 'Intervals', leftMs, totalS: steps[at.index].seconds, paused: Boolean(run.pausedAt), texts: SHADE_TEXTS });
  }, [shadeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (hadShade.current) followShadeOff(); }, []);

  // Pause, Resume, ±15 s and Next pressed in the shade.
  const live = Boolean(run) && !done;
  useEffect(() => {
    if (!live) return undefined;
    return onFollowShade((e) => {
      useIntervalRun.getState().fromShade(e);
      last.current = null;
      setNow(Date.now());
    });
  }, [live]);

  if (!run || pathname === '/intervals') return null;
  const { steps, at } = pos;
  const what = done ? (run.saved ? t('intervals.pillSaved') : '') : run.pausedAt ? t('pill.paused') : intervalLines(steps, at.index, run.moves).title;
  return (
    <div className={`timer-pill${done ? ' done' : ''}`} role="timer" aria-live="off">
      <button type="button" className="pill-open" onClick={() => navigate('/intervals')} aria-label={t('intervals.pillOpen')}>
        <Icon name="waves" />
        <span className="t">{done ? t('intervals.done') : clock(at.left)}</span>
        <span className="pill-what">{what}</span>
      </button>
      {done
        ? <button type="button" className="pill-btn" onClick={() => useIntervalRun.getState().clear()}>{t('pill.close')}</button>
        : <button type="button" className="pill-btn" onClick={() => useIntervalRun.getState().togglePause()}>{run.pausedAt ? t('shade.resume') : t('shade.pause')}</button>}
    </div>
  );
}
