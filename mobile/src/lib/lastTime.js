// "Last time, then today" (CHARTS step 2-3, DV-05/09/11, BI-03/08/09): what
// you did the last time you ran this session, set by set, and how today
// compares. Same exercise only, so a swap never shows a false change.
// Timed holds compare seconds; load sets compare kg, then reps. Pure,
// tested in lastTime.test.js.
import { e1rm, isLoadSet, isWorkSet } from './data.js';

/** A change smaller than this share of the last best is noise: "held". */
export const HELD_SHARE = 0.02;

const newestFirst = (a, b) => (a.log_date === b.log_date ? b.id - a.id : a.log_date < b.log_date ? 1 : -1);

/** The most recent finished workout of this plan session before `today`
 * (or before the workout `excludeId`), or null.
 * @param {import('../types').Data} data @param {string} sessionKey */
export function lastSession(data, sessionKey, today, excludeId = null) {
  if (!sessionKey) return null;
  return data.workouts
    .filter((w) => w.session_key === sessionKey && w.id !== excludeId && w.finished_at && w.log_date <= today && w.sets.some(isWorkSet))
    .sort(newestFirst)[0] || null;
}

/** The work sets of one exercise in a workout, in set order. */
export function setsOf(workout, exerciseId) {
  return (workout?.sets || []).filter((s) => s.exercise_id === exerciseId && isWorkSet(s));
}

/** One set against the same set number last time:
 * { kind: 'kg' | 'reps' | 'secs' | 'same', diff } (diff signed), or null
 * when there was no such set. Weight first: more kg is up even with a rep
 * less, the way people progress. */
export function setChange(prev, cur) {
  if (!prev || !cur) return null;
  if (cur.track === 'time' || prev.track === 'time') {
    const d = (cur.duration_s ?? cur.reps ?? 0) - (prev.duration_s ?? prev.reps ?? 0);
    return d ? { kind: 'secs', diff: d } : { kind: 'same', diff: 0 };
  }
  const kg = Math.round(((cur.weight_kg || 0) - (prev.weight_kg || 0)) * 100) / 100;
  if (kg) return { kind: 'kg', diff: kg };
  const reps = (cur.reps || 0) - (prev.reps || 0);
  return reps ? { kind: 'reps', diff: reps } : { kind: 'same', diff: 0 };
}

/** The best e1RM of a list of sets (load sets only), or 0. */
function bestE1rm(sets) {
  return Math.max(0, ...sets.filter(isLoadSet).map((s) => e1rm(s.weight_kg, s.reps)));
}

/** The top set of a list: the best e1RM load set, else the longest hold,
 * else the most reps. */
export function topSet(sets) {
  const load = sets.filter((s) => isLoadSet(s) && s.weight_kg > 0);
  if (load.length) return load.reduce((a, b) => (e1rm(b.weight_kg, b.reps) > e1rm(a.weight_kg, a.reps) ? b : a));
  return sets.reduce((a, b) => (((b.duration_s ?? b.reps) || 0) > ((a?.duration_s ?? a?.reps) || 0) ? b : a), null);
}

/** 'up' | 'held' | 'down' for one exercise, today's sets against last
 * time's. Changes under 2% of last time's best are 'held'. Holds and
 * bodyweight moves compare their best seconds or reps the same way. */
export function liftOutcome(prevSets, curSets) {
  let before = bestE1rm(prevSets);
  let now = bestE1rm(curSets);
  if (!before || !now) {
    const v = (sets) => Math.max(0, ...sets.map((s) => (s.duration_s ?? s.reps) || 0));
    before = v(prevSets);
    now = v(curSets);
  }
  if (!before || !now) return null;
  const share = (now - before) / before;
  if (Math.abs(share) < HELD_SHARE) return 'held';
  return share > 0 ? 'up' : 'down';
}

/** The finish sheet's comparison: one row per exercise done today, in the
 * order done, against the last session of the same plan session.
 *   { last: workout | null, rows: [{ exercise_id, top, outcome }], counts: { up, held, down } }
 * outcome is null for an exercise new to this session. */
export function compareToLast(data, workout) {
  const last = lastSession(data, workout.session_key, workout.log_date, workout.id);
  const ids = [...new Set(workout.sets.filter(isWorkSet).map((s) => s.exercise_id))];
  const counts = { up: 0, held: 0, down: 0 };
  const rows = ids.map((id) => {
    const cur = setsOf(workout, id);
    const prev = setsOf(last, id);
    const outcome = prev.length ? liftOutcome(prev, cur) : null;
    if (outcome) counts[outcome] += 1;
    return { exercise_id: id, top: topSet(cur), outcome };
  });
  return { last, rows, counts };
}

const kgText = (kg) => String(Math.round(kg * 100) / 100);

/** Sets as one short line: "60 × 8, 8, 7" when the weight held, else
 * "60 × 8, 57.5 × 7"; holds as "45 s, 50 s"; bodyweight as "12, 10". */
export function setsText(sets) {
  if (!sets.length) return '';
  if (sets.every((s) => s.track === 'time')) return sets.map((s) => `${s.duration_s ?? s.reps} s`).join(', ');
  const kgs = new Set(sets.map((s) => s.weight_kg || 0));
  if (kgs.size === 1) {
    const kg = sets[0].weight_kg || 0;
    const reps = sets.map((s) => s.reps ?? 0).join(', ');
    return kg > 0 ? `${kgText(kg)} × ${reps}` : reps;
  }
  return sets.map((s) => (s.weight_kg > 0 ? `${kgText(s.weight_kg)} × ${s.reps}` : String(s.reps))).join(', ');
}

/** Home's "last time" lines for today's session: the last run's date,
 * work sets and minutes, and its first `n` exercises as text.
 *   { date, sets, minutes, lifts: [{ exercise_id, name, text }] } or null */
export function lastTimePreview(data, sessionKey, today, n = 2) {
  const w = lastSession(data, sessionKey, today);
  if (!w || w.log_date >= today) return null;
  const work = w.sets.filter(isWorkSet);
  const ids = [...new Set(work.map((s) => s.exercise_id))].slice(0, n);
  const names = new Map((data.exercises || []).map((e) => [e.id, e.name]));
  return {
    date: w.log_date,
    sets: work.length,
    minutes: w.duration_min || null,
    lifts: ids.map((id) => ({ exercise_id: id, name: names.get(id) || '', text: setsText(setsOf(w, id)) })),
  };
}
