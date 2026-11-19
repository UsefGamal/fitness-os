// Small motion rules for the "satisfying feel" (SA-05, SA-06). Pure helpers,
// tested in motion.test.js; the DOM side lives in components/CountUp.jsx and
// store/pops.js.

/** Ease-out for count-ups: fast start, gentle landing. */
export function easeOut(t) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

/** The number a count-up shows `elapsed` ms into a `duration` ms run. */
export function countAt(from, to, elapsed, duration = 450) {
  if (duration <= 0 || elapsed >= duration) return to;
  return Math.round(from + (to - from) * easeOut(elapsed / duration));
}

/** SA-06: no new reward sound in the last 3 seconds of a rest, so nothing
 * talks over the 3-2-1 and the rest-done chime. `endsAt` is the rest timer's
 * end (ms), null when no rest is running. */
export const QUIET_BEFORE_REST_END_MS = 3000;
export function restQuiet(endsAt, now = Date.now()) {
  if (!endsAt) return false;
  const left = endsAt - now;
  return left > 0 && left <= QUIET_BEFORE_REST_END_MS;
}

/** MOVE-1, colour follows progress: the class a progress bar gets. 'full'
 * (gold) once the target is met, 'over' (amber) past `overAt` times it, ''
 * otherwise. Pass overAt: Infinity where more is fine (protein, water). */
export function fillTone(value, target, { overAt = 1.1 } = {}) {
  if (!target || !(value > 0)) return '';
  const f = value / target;
  if (f > overAt) return 'over';
  return f >= 1 ? 'full' : '';
}

/** MOVE-1: the rest timer turns yellow in its last 10 seconds. */
export const ENDING_S = 10;
export function restEnding(leftS, running = true) {
  return running && leftS > 0 && leftS <= ENDING_S;
}

/**
 * How a page change moves (MOVE-2). `isTab`: the new page is a tab;
 * `swipe`: 'forward' | 'back' when it came from the tab bar or a sideways
 * swipe; `back`: Android back / history pop; `seen`: this page was already
 * open once since the app started.
 * Returns the new page's entrance class, whether its cards rise in one after
 * another (only the first time a tab opens, never when coming back), and how
 * the old page leaves ('push': it slides a little left under the new one,
 * 'pop': it slides right off the top, null: it just goes, for tab switches).
 */
export function pageMotion({ isTab = false, swipe = null, back = false, seen = false } = {}) {
  // Back wins: the history entry of a tab keeps the swipe it was opened with.
  if (isTab && swipe && !back) return { enter: swipe === 'forward' ? 'swipe-fwd' : 'swipe-back', rise: !seen, ghost: null };
  const enter = back ? 'pop-in' : isTab ? 'tab-in' : 'push-in';
  return { enter, rise: !back && !(isTab && seen), ghost: back ? 'pop' : 'push' };
}
