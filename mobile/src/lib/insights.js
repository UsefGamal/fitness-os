// What the Stats page shows about training: sets per muscle group, which
// groups are still recovering or have gone untrained, a year of training
// days, week streaks and estimated-1RM history. Pure helpers, tested in
// insights.test.js.
import { addDays, daysBetween, fromISO, weekStart } from './dates.js';
import { e1rm, isWorkSet } from './data.js';

export const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];
export const RECOVER_DAYS = 2; // a group trained in the last 48 h is still recovering
export const UNTRAINED_DAYS = 7;

function groupOfExercise(data) {
  const byId = new Map(data.exercises.map((e) => [e.id, e.muscle_group]));
  return (id) => byId.get(id) || null;
}

/** Working sets per group in the `days` days up to and including `today`. */
export function setsByGroup(data, today, days = 7) {
  const from = addDays(today, -(days - 1));
  const groupOf = groupOfExercise(data);
  const out = Object.fromEntries(GROUPS.map((g) => [g, 0]));
  for (const w of data.workouts) {
    if (w.log_date < from || w.log_date > today) continue;
    for (const s of w.sets) {
      if (!isWorkSet(s)) continue;
      const g = groupOf(s.exercise_id);
      if (g in out) out[g] += 1;
    }
  }
  return out;
}

/** Last date each group got at least one set: { Chest: 'YYYY-MM-DD' | null }. */
export function lastTrained(data, today) {
  const groupOf = groupOfExercise(data);
  const out = Object.fromEntries(GROUPS.map((g) => [g, null]));
  for (const w of data.workouts) {
    if (w.log_date > today) continue;
    for (const s of w.sets) {
      if (!isWorkSet(s)) continue;
      const g = groupOf(s.exercise_id);
      if (g in out && (!out[g] || w.log_date > out[g])) out[g] = w.log_date;
    }
  }
  return out;
}

/** 'recovering' | 'ready' | 'untrained' per group. */
export function recoveryState(data, today) {
  const last = lastTrained(data, today);
  return Object.fromEntries(GROUPS.map((g) => {
    if (!last[g]) return [g, 'untrained'];
    const ago = daysBetween(last[g], today);
    return [g, ago < RECOVER_DAYS ? 'recovering' : ago >= UNTRAINED_DAYS ? 'untrained' : 'ready'];
  }));
}

/** Volume tone from 0 (none) to 3 (12+ sets a week, a full dose). */
export function volumeLevel(sets) {
  if (!sets) return 0;
  if (sets < 6) return 1;
  if (sets < 12) return 2;
  return 3;
}

/** Workouts per date (any type). */
export function countsByDate(data) {
  const out = new Map();
  for (const w of data.workouts) out.set(w.log_date, (out.get(w.log_date) || 0) + 1);
  return out;
}

/** A year of days as Sunday-start weeks, oldest first, ending with this
 * week: [[{ date, count, future }] x 7] x weeks. */
export function yearGrid(data, today, weeks = 53) {
  const counts = countsByDate(data);
  const first = addDays(weekStart(today), -7 * (weeks - 1));
  const grid = [];
  for (let w = 0; w < weeks; w += 1) {
    const col = [];
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(first, w * 7 + d);
      col.push({ date, count: counts.get(date) || 0, future: date > today });
    }
    grid.push(col);
  }
  return grid;
}

/** Weeks in a row with at least `min` workouts: { current, longest }. The
 * current week counts once it reaches `min`; until then the run that ended
 * last week still stands. */
export function weekStreaks(data, today, min = 1) {
  const perWeek = new Map();
  for (const w of data.workouts) {
    if (w.log_date > today) continue;
    const k = weekStart(w.log_date);
    perWeek.set(k, (perWeek.get(k) || 0) + 1);
  }
  if (!perWeek.size) return { current: 0, longest: 0 };
  const hit = (k) => (perWeek.get(k) || 0) >= min;
  let longest = 0;
  let run = 0;
  const firstWeek = [...perWeek.keys()].sort()[0];
  for (let k = firstWeek; k <= weekStart(today); k = addDays(k, 7)) {
    run = hit(k) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  let k = weekStart(today);
  if (!hit(k)) k = addDays(k, -7);
  while (hit(k)) {
    current += 1;
    k = addDays(k, -7);
  }
  return { current, longest };
}

/** Best estimated 1RM per day for one exercise, oldest first. */
export function e1rmSeries(data, exerciseId) {
  const best = new Map();
  for (const w of data.workouts) {
    for (const s of w.sets) {
      if (s.exercise_id !== exerciseId || !isWorkSet(s)) continue;
      const v = e1rm(s.weight_kg, s.reps);
      if (v > (best.get(w.log_date) || 0)) best.set(w.log_date, v);
    }
  }
  return [...best].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, value]) => ({ date, value: Math.round(value * 10) / 10 }));
}

/** Exercises with logged weight, most-trained first: [{ id, name, sessions }]. */
export function trackedExercises(data) {
  const sessions = new Map();
  for (const w of data.workouts) {
    for (const id of new Set(w.sets.filter((s) => s.weight_kg > 0 && isWorkSet(s)).map((s) => s.exercise_id))) {
      sessions.set(id, (sessions.get(id) || 0) + 1);
    }
  }
  const names = new Map(data.exercises.map((e) => [e.id, e.name]));
  return [...sessions].map(([id, n]) => ({ id, name: names.get(id) || 'Exercise', sessions: n }))
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

/** Total kg lifted (weight x reps) across every work set. */
export function totalVolume(data) {
  return data.workouts.reduce((n, w) => n + w.sets.reduce((m, s) => m + (isWorkSet(s) ? (s.weight_kg || 0) * (s.reps || 0) : 0), 0), 0);
}

/** Months covered by a year grid, for the labels: [{ col, label }]. */
export function monthLabels(grid) {
  const out = [];
  let last = -1;
  grid.forEach((col, i) => {
    const m = fromISO(col[0].date).getMonth();
    if (m !== last) {
      out.push({ col: i, label: fromISO(col[0].date).toLocaleString('en', { month: 'short' }) });
      last = m;
    }
  });
  return out;
}

/** The app groups a planned day works, from its exercise names. */
export function dayGroups(data, exercises = []) {
  const byName = new Map(data.exercises.map((e) => [e.name, e.muscle_group]));
  return new Set(exercises.map((ex) => byName.get(ex.name)).filter((g) => GROUPS.includes(g)));
}
