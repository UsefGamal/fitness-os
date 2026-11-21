// The interval session under way, kept outside the Intervals page so it
// keeps running (sounds, notification) while you look at another page, and
// kept in localStorage so it comes back if the phone kills the app.
// components/IntervalRunner.jsx drives it; views/Intervals.jsx shows it.
import { create } from 'zustand';

import { todayISO } from '../lib/dates.js';
import * as D from '../lib/data.js';
import { intervalLog } from '../lib/intervals.js';
import { intervalSteps, stepAt } from '../lib/training.js';
import { syncHealth } from './phoneSync.js';
import { useData } from './useData.js';

const KEY = 'fitness-os-interval-run';
// A run older than this when the app opens again is dropped, not resumed.
const STALE_MS = 6 * 60 * 60 * 1000;

function restore() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!r || !r.config || !Number.isFinite(r.startedAt) || Date.now() - r.startedAt > STALE_MS) return null;
    return { moves: [], pausedAt: null, pausedMs: 0, saved: false, ...r };
  } catch {
    return null;
  }
}

function keep(run) {
  try {
    if (run) localStorage.setItem(KEY, JSON.stringify(run));
    else localStorage.removeItem(KEY);
  } catch {
    // No storage: the run just isn't kept.
  }
}

/** Milliseconds of work done so far (pauses left out). */
export function elapsedOf(run, now = Date.now()) {
  return run ? Math.max(0, (run.pausedAt || now) - run.startedAt - run.pausedMs) : 0;
}

/** Where the run is: { steps, at } with at = { index, left, done }. */
export function positionOf(run, now = Date.now()) {
  const steps = intervalSteps(run.config);
  return { steps, at: stepAt(steps, Math.floor(elapsedOf(run, now) / 1000)) };
}

const startOf = (steps, i) => steps.slice(0, Math.max(0, i)).reduce((n, s) => n + s.seconds, 0);

export const useIntervalRun = create((set, get) => {
  const put = (run) => {
    keep(run);
    set({ run });
  };
  return {
    run: restore(),
    start(config, moves) {
      put({ config, moves: [...moves], startedAt: Date.now(), pausedAt: null, pausedMs: 0, saved: false });
    },
    togglePause() {
      const r = get().run;
      if (!r) return;
      const now = Date.now();
      put(r.pausedAt ? { ...r, pausedAt: null, pausedMs: r.pausedMs + (now - r.pausedAt) } : { ...r, pausedAt: now });
    },
    /** Start step `i` now (Next or Back). */
    jump(i) {
      const r = get().run;
      if (!r) return;
      const steps = intervalSteps(r.config);
      const now = Date.now();
      put({ ...r, startedAt: (r.pausedAt || now) - r.pausedMs - startOf(steps, Math.min(i, steps.length)) * 1000 });
    },
    /** The shade's Pause, Resume, ±15 s or Next: put the clock where it says. */
    fromShade(e) {
      const r = get().run;
      if (!r) return;
      const now = Date.now();
      const steps = intervalSteps(r.config);
      const here = stepAt(steps, Math.floor(elapsedOf(r, now) / 1000));
      if (here.done) return;
      const end = startOf(steps, here.index + 1) * 1000;
      const want = e.skipped ? end : end - Math.max(0, e.leftMs);
      const at = e.paused ? (r.pausedAt || now) : now;
      put({ ...r, startedAt: at - r.pausedMs - want, pausedAt: e.paused ? at : null });
    },
    /** Save what was done to History (once). False when not one round was done. */
    save() {
      const r = get().run;
      if (!r || r.saved) return Boolean(r?.saved);
      const steps = intervalSteps(r.config);
      const log = intervalLog({ config: r.config, moves: r.moves, steps, elapsedS: Math.floor(elapsedOf(r) / 1000) });
      if (!log) return false;
      useData.getState().update((d) => D.logSession(d, { date: todayISO(), ...log }));
      syncHealth().catch(() => {});
      put({ ...r, saved: true });
      return true;
    },
    clear() {
      put(null);
    },
  };
});
