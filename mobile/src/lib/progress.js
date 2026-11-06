// The goal card's maths (E10-S1), ported from content/projections.py and
// extended. Pure helpers, tested in progress.test.js.
//
//  - Trend weight: an exponential moving average of the weigh-ins, so one
//    salty day doesn't move the card. Gaps between weigh-ins are allowed
//    for: alpha grows with the days since the last one.
//  - Pace: the least-squares slope of the trend over the last 4 weeks, in kg
//    a week and % of body weight a week. Needs 3 weigh-ins over 14+ days.
//  - Safe band per goal direction (lose 0.5-1 %BW a week, gain 0.25-0.5,
//    maintain within ±0.25).
//  - Reach date: a range (pace ±10%), set beside the goal date. The card
//    never says "behind": a later range is "a little after", a flat trend is
//    "holding", and the next step is always something to do.
import { addDays, daysBetween } from './dates.js';

export const EMA_ALPHA = 0.1; // per day
export const PACE_WINDOW_DAYS = 28;
export const MIN_SPAN_DAYS = 14;
export const MIN_LOGS = 3;
// Recomp loses slowly on purpose: about 0.25-0.5% of body weight a week.
export const BANDS = { lose: [0.5, 1], recomp: [0.25, 0.5], gain: [0.25, 0.5], maintain: [-0.25, 0.25] };

/** [{ date, weight, trend }] in date order, weigh-ins without a weight dropped. */
export function trendSeries(logs = []) {
  const byDate = new Map();
  for (const l of logs) if (l && l.weight_kg > 0 && l.log_date) byDate.set(l.log_date, l); // the last one of a day wins
  const sorted = [...byDate.values()].sort((a, b) => (a.log_date < b.log_date ? -1 : 1));
  const out = [];
  for (const l of sorted) {
    const prev = out[out.length - 1];
    if (!prev) { out.push({ date: l.log_date, weight: l.weight_kg, trend: l.weight_kg }); continue; }
    const gap = Math.max(1, daysBetween(prev.date, l.log_date));
    const a = 1 - (1 - EMA_ALPHA) ** gap;
    out.push({ date: l.log_date, weight: l.weight_kg, trend: prev.trend + a * (l.weight_kg - prev.trend) });
  }
  return out.map((p) => ({ ...p, trend: Math.round(p.trend * 100) / 100 }));
}

/** Least-squares slope of [{ date, y }], in kg a week, positive = losing.
 * Same as projections.linear_rate_kg_per_week: null under 2 points or a
 * span under 7 days. */
export function linearRate(points) {
  if (points.length < 2) return null;
  const first = points[0].date;
  if (daysBetween(first, points[points.length - 1].date) < 7) return null;
  const xs = points.map((p) => daysBetween(first, p.date));
  const ys = points.map((p) => p.y);
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sx2 = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sx2 - sx * sx;
  if (denom === 0) return null;
  return Math.round((-(n * sxy - sx * sy) / denom) * 7 * 1000) / 1000;
}

/** Same as projections.predicted_goal_date. */
export function predictedDate(current, goal, ratePerWeek, today) {
  if (ratePerWeek == null || ratePerWeek <= 0) return null;
  const remaining = current - goal;
  if (remaining <= 0) return today;
  return addDays(today, Math.round((remaining / ratePerWeek) * 7));
}

/** Everything the goal card shows, or null with no weigh-ins.
 * goal: { direction, start_weight_kg, target_low_kg, target_high_kg, target_date } */
export function goalProgress(logs, goal, today) {
  const series = trendSeries(logs);
  if (!series.length) return null;
  const mode = ['gain', 'maintain', 'recomp'].includes(goal?.direction) ? goal.direction : 'lose';
  const last = series[series.length - 1];
  const trend = last.trend;
  const low = goal?.target_low_kg;
  const high = goal?.target_high_kg;
  const target = low != null && high != null ? (low + high) / 2 : null;
  const start = goal?.start_weight_kg ?? series[0].weight;
  const sign = mode === 'gain' ? -1 : 1; // pace is "towards the goal"

  const recent = series.filter((p) => daysBetween(p.date, last.date) <= PACE_WINDOW_DAYS);
  const span = daysBetween(recent[0].date, last.date);
  const enough = recent.length >= MIN_LOGS && span >= MIN_SPAN_DAYS;
  const raw = enough ? linearRate(recent.map((p) => ({ date: p.date, y: p.trend }))) : null;
  const pace = raw == null ? null : Math.round(sign * raw * 100) / 100; // kg/wk towards the goal
  const pct = pace == null ? null : Math.round((pace / trend) * 1000) / 10; // %BW/wk
  const band = BANDS[mode];

  let status = 'early';
  if (pct != null) {
    if (mode === 'maintain') status = Math.abs(pct) <= band[1] ? 'steady' : 'drifting';
    else if (pct > band[1]) status = 'fast';
    else if (pct >= band[0]) status = 'steady';
    else if (pct > 0) status = 'slow';
    else status = 'holding';
  }
  const reached = target != null && (mode === 'gain' ? trend >= (low ?? target) : mode === 'lose' || mode === 'recomp' ? trend <= (high ?? target) : false);
  if (reached) status = 'reached';

  let range = null;
  let vsGoal = null;
  if (mode !== 'maintain' && target != null && pace > 0 && !reached) {
    const left = Math.abs(trend - target);
    const early = addDays(today, Math.round((left / (pace * 1.1)) * 7));
    const late = addDays(today, Math.round((left / (pace * 0.9)) * 7));
    range = [early, late];
    if (goal?.target_date) vsGoal = late < goal.target_date ? 'ahead' : early > goal.target_date ? 'after' : 'on';
  }
  return {
    mode,
    trend: Math.round(trend * 10) / 10,
    latest: last.weight,
    latest_date: last.date,
    start,
    target,
    done_kg: Math.round(sign * (start - trend) * 10) / 10,
    left_kg: target == null ? null : Math.round(Math.abs(trend - target) * 10) / 10,
    share_done: target == null || start === target ? null : Math.max(0, Math.min(1, (start - trend) / (start - target))),
    pace,
    pct,
    band,
    status,
    range,
    goal_date: goal?.target_date ?? null,
    vs_goal: vsGoal,
    logs_needed: enough ? 0 : Math.max(MIN_LOGS - recent.length, 1),
    series,
  };
}
