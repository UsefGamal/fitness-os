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
