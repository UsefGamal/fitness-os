// Stats > Body (charts step 4, C-1 + BI-21): the weight chart's frame and
// weekly averages. Pure, tested in bodyStats.test.js.
import { addDays, daysBetween } from './dates.js';
import { trendSeries } from './progress.js';
import { weekStart } from './dates.js';

/** Days shown for each range of the chart. */
export const RANGES = { m1: 28, m3: 91, all: Infinity };
/** A week with fewer weigh-ins than this is drawn faint: one salty day
 * would swing its average. */
export const THIN_WEEK = 3;

/**
 * What the weight chart draws for a range ('m1' | 'm3' | 'all'):
 *   { points: [{ date, weight, trend }], lo, hi, ticks: [kg], goal }
 * The scale fits the data (plus half a kilo), not the goal, so 8 kg of
 * loss doesn't flatten into a wiggle. goal: 'below' | 'above' | 'in' |
 * null says where the goal range sits against the drawn scale.
 * @param {import('../types').BodyLog[]} logs */
export function weightFrame(logs, today, range = 'm3', goal = null) {
  const days = RANGES[range] ?? RANGES.m3;
  const from = Number.isFinite(days) ? addDays(today, -(days - 1)) : '';
  const points = trendSeries(logs).filter((p) => p.date >= from && p.date <= today);
  if (points.length < 2) return { points, lo: null, hi: null, ticks: [], goal: null };
  const vals = points.flatMap((p) => [p.weight, p.trend]);
  let lo = Math.floor((Math.min(...vals) - 0.5) * 2) / 2;
  let hi = Math.ceil((Math.max(...vals) + 0.5) * 2) / 2;
  if (hi - lo < 2) { const mid = (hi + lo) / 2; lo = mid - 1; hi = mid + 1; }
  const step = niceStep((hi - lo) / 3);
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
  let where = null;
  if (goal && goal.low != null && goal.high != null) where = goal.high < lo ? 'below' : goal.low > hi ? 'above' : 'in';
  return { points, lo, hi, ticks, goal: where };
}

function niceStep(raw) {
  for (const s of [0.5, 1, 2, 2.5, 5, 10, 20]) if (s >= raw) return s;
  return 50;
}

/**
 * The last `n` weeks' average weigh-in, newest first:
 *   [{ week, avg, n, change, thin, current }]
 * change is against the week before (null for the oldest, or after a week
 * with no weigh-ins). current marks this week, which is still filling.
 * @param {import('../types').BodyLog[]} logs @param {any} data for the week start */
export function weeklyAverages(logs, today, data, n = 6) {
  const by = new Map();
  for (const p of trendSeries(logs)) {
    if (p.date > today) continue;
    const k = weekStart(p.date, data);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(p.weight);
  }
  const thisWeek = weekStart(today, data);
  const out = [];
  for (let i = 0; i < n + 1; i += 1) {
    const k = addDays(thisWeek, -7 * i);
    const ws = by.get(k);
    out.push(ws ? { week: k, avg: Math.round((ws.reduce((a, b) => a + b, 0) / ws.length) * 10) / 10, n: ws.length } : { week: k, avg: null, n: 0 });
  }
  return out.slice(0, n).map((w, i) => {
    const prev = out[i + 1];
    return {
      ...w,
      change: w.avg != null && prev?.avg != null ? Math.round((w.avg - prev.avg) * 10) / 10 : null,
      thin: w.n < THIN_WEEK,
      current: i === 0,
    };
  }).filter((w) => w.n > 0);
}

/**
 * Where the date labels go under a chart from `from` to `to`: each Monday
 * a week apart counting back from `to` for a month or less, the first of
 * each month for longer. [{ date, kind: 'week' | 'month' }]
 */
export function dateTicks(from, to) {
  if (!from || !to || from > to) return [];
  const out = [];
  if (daysBetween(from, to) <= 45) {
    for (let d = to; d >= from; d = addDays(d, -7)) out.unshift({ date: d, kind: 'week' });
    return out;
  }
  let [y, m] = from.split('-').map(Number);
  for (;;) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    const d = `${y}-${String(m).padStart(2, '0')}-01`;
    if (d > to) break;
    out.push({ date: d, kind: 'month' });
  }
  return out;
}
