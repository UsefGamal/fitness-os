// Which lifts are moving (charts step 3, DV-14 / BI-18): each lift's best
// estimated 1RM in the last 4 weeks against the 4 weeks before, as up,
// held or down. A lift needs 2 sessions in each window to be judged.
// Load sets only (no holds) and no recovery-week (deload) sessions, whose
// lighter loads are on purpose. Pure, tested in movers.test.js.
import { addDays } from './dates.js';
import { e1rm, isLoadSet } from './data.js';
import { HELD_SHARE } from './lastTime.js';

export const WINDOW = 28;
export const MIN_SESSIONS = 2;

/**
 * { counts: { up, held, down }, waiting, rows }
 *   rows: [{ exercise_id, name, now, before, kg, pct, outcome, spark }]
 *   sorted biggest change first; spark = weekly best e1RM over the 8
 *   weeks (null for a week without the lift). waiting = lifts done in
 *   the last 4 weeks without enough sessions to judge.
 * @param {import('../types').Data} data @param {string} today */
export function strengthMovers(data, today) {
  const recentFrom = addDays(today, -(WINDOW - 1));
  const priorFrom = addDays(today, -(2 * WINDOW - 1));
  /** @type {Map<number, { recent: Map<string, number>, prior: Map<string, number> }>} */
  const by = new Map();
  for (const w of data.workouts) {
    if (w.is_deload || w.log_date < priorFrom || w.log_date > today) continue;
    const side = w.log_date >= recentFrom ? 'recent' : 'prior';
    for (const s of w.sets) {
      if (!isLoadSet(s) || !(s.weight_kg > 0) || !(s.reps > 0)) continue;
      const v = e1rm(s.weight_kg, s.reps);
      if (!by.has(s.exercise_id)) by.set(s.exercise_id, { recent: new Map(), prior: new Map() });
      const m = by.get(s.exercise_id)[side];
      if (v > (m.get(w.log_date) || 0)) m.set(w.log_date, v);
    }
  }
  const names = new Map((data.exercises || []).map((e) => [e.id, e.name]));
  const counts = { up: 0, held: 0, down: 0 };
  let waiting = 0;
  const rows = [];
  for (const [id, { recent, prior }] of by) {
    if (recent.size < MIN_SESSIONS || prior.size < MIN_SESSIONS) {
      if (recent.size) waiting += 1;
      continue;
    }
    const now = Math.max(...recent.values());
    const before = Math.max(...prior.values());
    const share = (now - before) / before;
    const outcome = Math.abs(share) < HELD_SHARE ? 'held' : share > 0 ? 'up' : 'down';
    counts[outcome] += 1;
    const spark = [];
    for (let k = 7; k >= 0; k -= 1) {
      const from = addDays(today, -(7 * k + 6));
      const to = addDays(today, -7 * k);
      let best = 0;
      for (const [d, v] of [...prior, ...recent]) if (d >= from && d <= to && v > best) best = v;
      spark.push(best || null);
    }
    rows.push({ exercise_id: id, name: names.get(id) || '', now: Math.round(now * 10) / 10, before: Math.round(before * 10) / 10, kg: Math.round((now - before) * 10) / 10, pct: Math.round(share * 1000) / 10, outcome, spark });
  }
  rows.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || a.name.localeCompare(b.name));
  return { counts, waiting, rows };
}

/** An SVG path for a sparkline of values (nulls skipped), w x h. */
export function sparkLine(values, w = 60, h = 20, pad = 2) {
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (pts.length < 2) return null;
  const vs = pts.map(([, v]) => v);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const x = (i) => pad + (i / (values.length - 1)) * (w - 2 * pad);
  const y = (v) => (hi === lo ? h / 2 : h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad));
  return pts.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
}
