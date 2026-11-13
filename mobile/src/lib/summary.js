// What the finish summary shows after a workout is saved (UX-14), and when a
// session is short enough to say so before saving (UX-15).
import { addDays, weekStart } from './dates.js';
import { e1rm, isWorkSet, personalBests } from './data.js';
import { ranLong } from './training.js';

/** Under half the planned sets done: the Finish sheet names it a short session. */
export function isShortSession(done, planned) {
  return planned > 0 && done < planned / 2;
}

/** { durationMin, ranLong, sets, volumeKg, bests: [{ name, kg, reps }], weekSessions }
 * for one saved workout, or null when it isn't there. A best is the top set
 * of an exercise that beats every earlier workout; a first-ever set is not. */
export function workoutSummary(data, workoutId) {
  const w = data.workouts.find((x) => x.id === workoutId);
  if (!w) return null;
  const work = w.sets.filter(isWorkSet);
  const before = personalBests(data, w.id);
  const top = new Map();
  for (const s of work) {
    const score = e1rm(s.weight_kg, s.reps);
    const prev = before.get(s.exercise_id);
    if (!prev || !(score > prev.score)) continue;
    const cur = top.get(s.exercise_id);
    if (!cur || score > cur.score) top.set(s.exercise_id, { score, kg: s.weight_kg, reps: s.reps });
  }
  const bests = [...top].map(([id, b]) => ({ name: data.exercises.find((e) => e.id === id)?.name || '', kg: b.kg, reps: b.reps }));
  const from = weekStart(w.log_date);
  const to = addDays(from, 6);
  const days = new Set(data.workouts.filter((x) => x.finished_at && x.log_date >= from && x.log_date <= to).map((x) => x.log_date));
  return {
    durationMin: w.duration_min || null,
    ranLong: ranLong(w),
    sets: work.length,
    volumeKg: Math.round(work.reduce((v, s) => v + s.weight_kg * s.reps, 0)),
    bests,
    weekSessions: days.size,
  };
}
