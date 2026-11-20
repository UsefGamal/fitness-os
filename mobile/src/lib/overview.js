// Stats > Overview (charts step 4, BI-16 + DV-20): training days per week
// for 12 weeks, and whether lifts held up while the weight came down.
// Pure, tested in overview.test.js.
import { e1rm, isLoadSet } from './data.js';
import { addDays, weekStart } from './dates.js';
import { weekNeed } from './insights.js';
import { HELD_SHARE } from './lastTime.js';
import { currentGoal } from './macros.js';
import { trendSeries } from './progress.js';

export const OVERVIEW_WEEKS = 12;
export const KEPT_DAYS = 56;
export const KEPT_MIN_SESSIONS = 4;
export const KEPT_LIFTS = 3;

/** The last `n` weeks, oldest first: [{ week, days, need, deload, current }].
 * days are distinct training days, so a gym session and a walk on one day
 * count once, as the streak counts them. deload = a recovery week. */
export function weeklyDays(data, today, n = OVERVIEW_WEEKS) {
  const need = weekNeed(data);
  const thisWeek = weekStart(today, data);
  const from = addDays(thisWeek, -7 * (n - 1));
  const days = new Map();
  const deload = new Set();
  for (const w of data.workouts) {
    if (!w.log_date || w.log_date > today || w.log_date < from) continue;
    const k = weekStart(w.log_date, data);
    if (!days.has(k)) days.set(k, new Set());
    days.get(k).add(w.log_date);
    if (w.is_deload) deload.add(k);
  }
  return Array.from({ length: n }, (_, i) => {
    const week = addDays(from, 7 * i);
    return { week, days: days.get(week)?.size || 0, need: need(week), deload: deload.has(week), current: week === thisWeek };
  });
}

/**
 * For a fat-loss goal, the last 8 weeks of weight trend beside the best
 * estimated 1RM of the most-done lifts (4+ sessions, recovery weeks left
 * out), each as a change from its own start so they share one axis:
 *   { from, to, weight: { points: [{ date, kg }], change },
 *     lifts: [{ exercise_id, name, points: [{ date, pct }], pct, outcome }],
 *     counts: { up, held, down } }
 * A lift's outcome compares the best of its last two sessions with the best
 * of its first two (under 2% is held). null when the goal isn't to lose,
 * or there is no weight trend or no lift with enough sessions.
 * @param {import('../types').Data} data @param {string} today */
export function keptWhileCutting(data, today) {
  if ((currentGoal(data)?.direction || 'lose') !== 'lose') return null;
  const from = addDays(today, -(KEPT_DAYS - 1));
  const trend = trendSeries(data.body_logs).filter((p) => p.date >= from && p.date <= today);
  if (trend.length < 2) return null;
  const by = new Map();
  for (const w of data.workouts) {
    if (w.is_deload || w.log_date < from || w.log_date > today) continue;
    for (const s of w.sets || []) {
      if (!isLoadSet(s) || !(s.weight_kg > 0) || !(s.reps > 0)) continue;
      if (!by.has(s.exercise_id)) by.set(s.exercise_id, new Map());
      const m = by.get(s.exercise_id);
      const v = e1rm(s.weight_kg, s.reps);
      if (v > (m.get(w.log_date) || 0)) m.set(w.log_date, v);
    }
  }
  const names = new Map((data.exercises || []).map((e) => [e.id, e.name]));
  const lifts = [...by]
    .filter(([, m]) => m.size >= KEPT_MIN_SESSIONS)
    .sort((a, b) => b[1].size - a[1].size || (names.get(a[0]) || '').localeCompare(names.get(b[0]) || ''))
    .slice(0, KEPT_LIFTS)
    .map(([id, m]) => {
      const s = [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1));
      const base = s[0][1];
      const start = Math.max(s[0][1], s[1][1]);
      const end = Math.max(s[s.length - 1][1], s[s.length - 2][1]);
      const share = (end - start) / start;
      return {
        exercise_id: id,
        name: names.get(id) || '',
        points: s.map(([date, v]) => ({ date, pct: Math.round((v / base - 1) * 1000) / 10 })),
        pct: Math.round(share * 1000) / 10,
        outcome: Math.abs(share) < HELD_SHARE ? 'held' : share > 0 ? 'up' : 'down',
      };
    });
  if (!lifts.length) return null;
  const counts = { up: 0, held: 0, down: 0 };
  for (const l of lifts) counts[l.outcome] += 1;
  const kg = trend.map((p) => ({ date: p.date, kg: p.trend }));
  return {
    from,
    to: today,
    weight: { points: kg, change: Math.round((kg[kg.length - 1].kg - kg[0].kg) * 10) / 10 },
    lifts,
    counts,
  };
}
