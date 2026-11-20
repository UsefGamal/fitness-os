// Sessions without logged sets still train muscles: interval rounds, a
// ticked home workout, cardio and padel. This turns one such session into
// light "sets" on the muscles it works, so the muscle map, weekly sets and
// recovery see it. Lifting sets are counted where they always were; a
// session with sets gets nothing extra here. Pure helpers, tested in
// sessionLoad.test.js.
//
// How much each counts (kept low on purpose, these are not hard sets):
// - an interval work round = half a set for its move's muscles;
// - a ticked home-workout exercise = HOME_SETS sets;
// - cardio or sport = one light set per MIN_PER_SET minutes, at most
//   MAX_SPORT_SETS, on the muscles content/interval_program.py lists for it.
import { targetFor } from './muscles.js';

export const ROUND_SHARE = 0.5;
export const HOME_SETS = 2;
export const MIN_PER_SET = 20;
export const MAX_SPORT_SETS = 3;
// A session marks a muscle as worked (for recovery) from this much load.
export const WORKED_LOAD = 1.5;
const DEFAULT_MINUTES = { cardio: 25, padel: 90 };

const half = (x) => Math.round(x * 2) / 2;

/** The muscles a cardio or sport session works, by its type and name
 * (content SESSION_MUSCLES), or null. @param {any} w @param {any} training */
export function sessionMuscles(w, training) {
  const rows = training?.session_muscles || [];
  const text = `${w?.workout_type || ''} ${w?.notes || ''}`.toLowerCase();
  const row = rows.find((r) => r.words.some((word) => text.includes(word)));
  if (row) return { main: row.main, helpers: row.helpers };
  return null;
}

/** Light sets for `minutes` of cardio or sport. */
export function sportSets(minutes) {
  const m = Number(minutes) || 0;
  if (m < MIN_PER_SET / 2) return 0;
  return Math.min(MAX_SPORT_SETS, half(m / MIN_PER_SET));
}

/** The name in a checklist row: "Push-up · 12-20" -> "Push-up". */
const nameOf = (item) => String(item?.item_name || '').split(' · ')[0].trim();

/**
 * What a session without sets did to the muscles: [{ target, sets }], where
 * target is { main, helpers } muscles. Empty for a session with sets,
 * a recovery session, or one we can't place.
 * @param {any} w @param {any} training @param {(name: string) => any} [entryOf]
 * @returns {{ target: { main: string[], helpers: string[] }, sets: number }[]}
 */
export function sessionLoads(w, training, entryOf = () => null) {
  if (!w || (w.sets || []).length || w.workout_type === 'gym' || w.workout_type === 'recovery') return [];
  const items = Array.isArray(w.checklist_items) ? w.checklist_items : [];
  const out = [];
  if (w.intervals) {
    for (const c of items) {
      const rounds = Number(c?.reps_achieved) || 0;
      const target = rounds > 0 ? targetFor(nameOf(c), training, entryOf(nameOf(c))) : null;
      if (target?.main?.length) out.push({ target: { main: target.main, helpers: target.helpers || [] }, sets: rounds * ROUND_SHARE });
    }
    return out;
  }
  if (w.workout_type === 'home') {
    for (const c of items) {
      if (!c?.completed) continue;
      const target = targetFor(nameOf(c), training, entryOf(nameOf(c)));
      if (target?.main?.length) out.push({ target: { main: target.main, helpers: target.helpers || [] }, sets: HOME_SETS });
    }
    return out;
  }
  const target = sessionMuscles(w, training);
  const sets = sportSets(w.duration_min ?? DEFAULT_MINUTES[w.workout_type] ?? 0);
  return target && sets ? [{ target, sets }] : [];
}

/** Minutes of cardio and sport (cardio, padel, intervals) between two dates. */
export function cardioMinutes(workouts, from, to) {
  let n = 0;
  for (const w of workouts || []) {
    if (w.log_date < from || w.log_date > to) continue;
    if (w.workout_type === 'cardio' || w.workout_type === 'padel') n += Number(w.duration_min) || 0;
  }
  return n;
}

// The weekly guide for moderate activity (WHO: 150 minutes).
export const CARDIO_GUIDE_MIN = 150;
