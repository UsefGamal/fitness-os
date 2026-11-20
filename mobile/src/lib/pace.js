// Weight pace as a range (CHARTS step 2, BI-02). The goal card's single
// pace is the slope of the smoothed trend, which lags about 9 days and
// reads more exact than it is. This one is measured from the weigh-ins
// themselves: the Theil-Sen slope (the median of the slopes between every
// pair of weigh-ins over the last 28 days), with the middle half of those
// slopes as the range. It shrugs off a salty day or a skipped week.
// Pure, tested in pace.test.js.
import { addDays, daysBetween } from './dates.js';
import { BANDS, trendSeries } from './progress.js';

export const RANGE_WINDOW_DAYS = 28;
export const RANGE_MIN_LOGS = 8;
export const RANGE_MIN_SPAN = 14;
/** The first two weeks of a goal are mostly water: no pace from them. */
export const WATER_DAYS = 14;
/** An arrival window wider than this says "too early to date". */
export const MAX_WINDOW_DAYS = 42;

function quantile(sorted, q) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

const r1 = (n) => Math.round(n * 10) / 10;

/**
 * Pace towards the goal over the last 28 days, in kg a week (positive is
 * towards it: losing on a cut, gaining on a gain goal).
 *   { ready: true, mid, low, high, pct, n, status }  status as goalProgress
 *   { ready: false, need, reason }  need = weigh-ins still to log;
 *     reason 'logs' (too few or too short a span) or 'water' (the goal's
 *     first 14 days)
 * @param {import('../types').BodyLog[]} logs
 * @param {{ direction?: string, set_on?: string } | null} goal
 * @param {string} today */
export function paceRange(logs, goal, today) {
  const mode = ['gain', 'maintain', 'recomp'].includes(goal?.direction) ? goal.direction : 'lose';
  const sign = mode === 'gain' ? -1 : 1;
  const from = addDays(today, -(RANGE_WINDOW_DAYS - 1));
  const after = goal?.set_on ? addDays(goal.set_on, WATER_DAYS) : null;
  const pts = trendSeries(logs).filter((p) => p.date >= from && p.date <= today && (!after || p.date >= after));
  const span = pts.length ? daysBetween(pts[0].date, pts[pts.length - 1].date) : 0;
  if (goal?.set_on && daysBetween(goal.set_on, today) < WATER_DAYS) return { ready: false, need: 0, reason: 'water' };
  if (pts.length < RANGE_MIN_LOGS || span < RANGE_MIN_SPAN) {
    return { ready: false, need: Math.max(1, RANGE_MIN_LOGS - pts.length), reason: 'logs' };
  }
  const slopes = [];
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      const d = daysBetween(pts[i].date, pts[j].date);
      if (d > 0) slopes.push((sign * (pts[i].weight - pts[j].weight) / d) * 7);
    }
  }
  slopes.sort((a, b) => a - b);
  const mid = quantile(slopes, 0.5);
  const low = quantile(slopes, 0.25);
  const high = quantile(slopes, 0.75);
  const weight = pts[pts.length - 1].trend;
  const pct = (mid / weight) * 100;
  const band = BANDS[mode];
  let status;
  if (mode === 'maintain') status = Math.abs(pct) <= band[1] ? 'steady' : 'drifting';
  else if (pct > band[1]) status = 'fast';
  else if (pct >= band[0]) status = 'steady';
  else if (pct > 0) status = 'slow';
  else status = 'holding';
  return { ready: true, mid: r1(mid), low: r1(low), high: r1(high), pct: Math.round(pct * 100) / 100, n: pts.length, status };
}

/**
 * When the goal is reached at the measured pace: { early, late } dates, or
 * { tooEarly: true } when the window is wider than 6 weeks, or null when
 * the pace isn't towards the goal (or there is nothing left).
 * @param {number} trend @param {number} target @param {{ low: number, high: number }} pace @param {string} today */
export function arrivalWindow(trend, target, pace, today) {
  const left = Math.abs(trend - target);
  if (!(left > 0) || !(pace?.low > 0) || !(pace.high > 0)) return null;
  const early = addDays(today, Math.round((left / pace.high) * 7));
  const late = addDays(today, Math.round((left / pace.low) * 7));
  if (daysBetween(early, late) > MAX_WINDOW_DAYS) return { tooEarly: true };
  return { early, late };
}
