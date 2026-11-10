// Home page helpers (the Nov 2026 redesign). Pure, tested in home.test.js.
import { daysBetween } from './dates.js';

/** 'morning' 5-11, 'afternoon' 12-16, 'evening' otherwise. */
export function partOfDay(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

/** The first word of the name the person typed in Profile, at most 20
 * letters, or '' when there is none. */
export function firstName(profile) {
  const raw = typeof profile?.name === 'string' ? profile.name.trim() : '';
  return raw ? raw.split(/\s+/)[0].slice(0, 20) : '';
}

/** How the trend moved over the last `days` (default 14): { kg, days }
 * with kg = latest trend minus the trend on or before that day (negative =
 * down), or null with under two weigh-ins. Days is the real gap used. */
export function trendChange(series = [], days = 14) {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  let from = series[0];
  for (const p of series) if (daysBetween(p.date, last.date) >= days) from = p;
  if (from === last) return null;
  return { kg: Math.round((last.trend - from.trend) * 10) / 10, days: daysBetween(from.date, last.date) };
}

/** A small line for the weight card: the last `n` trend points scaled into
 * a w x h box (y grows down), as an SVG path, plus the last point. */
export function sparkPath(series = [], { n = 30, w = 120, h = 48, pad = 4 } = {}) {
  const pts = series.slice(-n).map((p) => p.trend);
  if (pts.length < 2) return null;
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const span = hi - lo || 1;
  const x = (i) => pad + (i / (pts.length - 1)) * (w - 2 * pad);
  const y = (v) => pad + (1 - (v - lo) / span) * (h - 2 * pad);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return { d, end: [Number(x(pts.length - 1).toFixed(1)), Number(y(pts[pts.length - 1]).toFixed(1))] };
}

/** The watch tiles on Home: steps, active kcal and sleep, only the ones
 * the watch sent today (it is worn only sometimes). Empty = no strip. */
export function watchTiles({ steps = null, kcal = null, sleepMin = null } = {}) {
  const out = [];
  if (steps != null) out.push({ key: 'steps', value: Number(steps).toLocaleString('en-US') });
  if (kcal != null) out.push({ key: 'kcal', value: String(kcal) });
  if (sleepMin != null && sleepMin > 0) out.push({ key: 'sleep', value: `${Math.floor(sleepMin / 60)}h ${String(sleepMin % 60).padStart(2, '0')}m` });
  return out;
}
