// Weekly sets per muscle (E4-S19). Counts hard sets this week for each of
// the ~15 muscles: a set counts 1 for the exercise's main muscles and 0.5
// for its helpers (content/exercise_targets.py, else the catalogue's tags).
// The guide is 10-20 hard sets a week per muscle. Pure helpers; tests in
// weeklySets.test.js.
import { isWorkSet } from './data.js';
import { weekStart } from './dates.js';
import { MUSCLE, MUSCLES, targetFor } from './muscles.js';
import { effectiveDay } from './planEdit.js';
import { weekView } from './schedule.js';

export const GUIDE = { low: 10, high: 20 };
export const HELPER_SHARE = 0.5;
// Muscles too small or too rare to list unless something hits them.
const QUIET = new Set(['neck', 'abductors', 'shins']);

function add(out, target, sets) {
  for (const m of target.main) if (MUSCLE[m]) out[m] = (out[m] || 0) + sets;
  for (const m of target.helpers) if (MUSCLE[m]) out[m] = (out[m] || 0) + sets * HELPER_SHARE;
}

/** Sets done this week (Sunday to `today`): { muscles: {key: sets}, unknown }.
 * Warm-up sets don't count. `entryOf(name)` finds a catalogue entry for an
 * exercise without a hand-checked target (optional). */
export function doneThisWeek(data, training, today, entryOf = () => null) {
  const from = weekStart(today);
  const byId = new Map(data.exercises.map((e) => [e.id, e.name]));
  const muscles = {};
  let unknown = 0;
  for (const w of data.workouts) {
    if (w.log_date < from || w.log_date > today) continue;
    for (const s of w.sets || []) {
      if (!isWorkSet(s)) continue;
      const name = byId.get(s.exercise_id);
      const target = name ? targetFor(name, training, entryOf(name)) : null;
      if (target) add(muscles, target, 1);
      else unknown += 1;
    }
  }
  return { muscles, unknown };
}

/** Sets the plan has this week (every session day of the Sunday-start week). */
export function plannedThisWeek(data, training, today, entryOf = () => null) {
  const muscles = {};
  let unknown = 0;
  for (const day of weekView(today, training, data.session_moves || [])) {
    if (day.key === 'rest') continue;
    const session = effectiveDay(day.key, training, data);
    for (const ex of session?.exercises || []) {
      const target = targetFor(ex.name, training, entryOf(ex.name));
      const sets = Number(ex.sets) || 0;
      if (target) add(muscles, target, sets);
      else unknown += sets;
    }
  }
  return { muscles, unknown };
}

/** 'none' | 'low' | 'good' | 'high' against the 10-20 guide. */
export function band(sets) {
  if (!sets) return 'none';
  if (sets < GUIDE.low) return 'low';
  if (sets > GUIDE.high) return 'high';
  return 'good';
}

/** Rows for the Stats card, in body order: [{ key, label, group, done, planned, band }]. */
export function muscleRows(done, planned) {
  return MUSCLES
    .filter((m) => !QUIET.has(m.key) || done[m.key] || planned[m.key])
    .map((m) => {
      const d = round(done[m.key] || 0);
      const p = round(planned[m.key] || 0);
      return { key: m.key, label: m.label, group: m.group, done: d, planned: p, band: band(p), doneBand: band(d) };
    });
}

const round = (n) => Math.round(n * 2) / 2;

