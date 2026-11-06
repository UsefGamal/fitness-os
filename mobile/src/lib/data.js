// Pure operations on the app's data. Every function takes the data object
// and returns a new one (or a derived value), so the store stays a thin
// shell and all of this is tested in data.test.js.
//
// The data shape grew out of the old server's export format
// ("fitness-os-export" v1, snake_case fields). lib/migrate.js upgrades any
// older copy to the current schema; this is what a new install starts with.
import { blockFromContent, CURRENT_SCHEMA, defaultDiet, defaultSafety } from './migrate.js';

export function emptyData(content) {
  const planStart = content.nutrition.plan_start_date;
  return {
    schemaVersion: CURRENT_SCHEMA,
    profile: null,
    goals: [],
    safety: defaultSafety(),
    diet: defaultDiet(planStart),
    program: { schedule_mode: 'weekdays', active_block: 'b1', blocks: [blockFromContent(content, { startedOn: planStart })] },
    checkins: [],
    rewards: { ledger: [] },
    exercises: seedExercises(content),
    body_logs: [],
    hydration_logs: [],
    workouts: [],
    meal_logs: [],
    bonus_logs: [],
    shopping: { week: null, checked: [] },
    settings: defaultSettings(),
  };
}

/** Modules follow openGym: areas you don't use can be switched off. */
export const MODULES = [
  { key: 'meals', label: 'Meals', note: 'Meal plan tab and the meals card on Home' },
  { key: 'water', label: 'Water', note: 'Water card on Home' },
  { key: 'weight', label: 'Weight', note: 'Weigh-ins on Home and Stats' },
];

export function defaultSettings() {
  return { notifications: false, modules: Object.fromEntries(MODULES.map((m) => [m.key, true])) };
}

export function moduleOn(data, key) {
  return data.settings?.modules?.[key] !== false;
}

export function seedExercises(content, existing = []) {
  const out = [...existing];
  const names = new Set(out.map((e) => e.name));
  let id = nextId(out);
  for (const [muscle_group, name, equipment] of content.training.exercise_library) {
    if (names.has(name)) continue;
    out.push({ id, name, muscle_group, equipment: equipment ?? null });
    names.add(name);
    id += 1;
  }
  return out;
}

export function nextId(rows) {
  return rows.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;
}

function allSets(data) {
  return data.workouts.flatMap((w) => w.sets.map((s) => ({ ...s, log_date: w.log_date, workout_id: w.id })));
}

export function exerciseByName(data, name) {
  return data.exercises.find((e) => e.name === name) || null;
}

// ── Workouts ──────────────────────────────────────────────────────────

export function startWorkout(data, { date, sessionKey, label, type = 'gym', isDeload = false }) {
  const id = nextId(data.workouts);
  const workout = {
    id,
    log_date: date,
    workout_type: type,
    duration_min: null,
    notes: label,
    session_rpe: null,
    is_deload: Boolean(isDeload),
    pain_note: null,
    result: null,
    session_key: sessionKey,
    block_id: data.program?.active_block ?? null,
    started_at: Date.now(),
    finished_at: null,
    sets: [],
    checklist_items: [],
  };
  return { data: { ...data, workouts: [...data.workouts, workout] }, workoutId: id };
}

function updateWorkout(data, workoutId, fn) {
  return { ...data, workouts: data.workouts.map((w) => (w.id === workoutId ? fn(w) : w)) };
}

export function addSet(data, workoutId, { exerciseId, reps, weightKg, rpe = null }) {
  const nextSetId = nextId(allSets(data));
  return updateWorkout(data, workoutId, (w) => {
    const setNumber = w.sets.filter((s) => s.exercise_id === exerciseId).length + 1;
    const set = { id: nextSetId, exercise_id: exerciseId, set_number: setNumber, reps, weight_kg: weightKg, rpe, rir: null, is_warmup: false };
    return { ...w, sets: [...w.sets, set] };
  });
}

export function updateSet(data, workoutId, setId, changes) {
  return updateWorkout(data, workoutId, (w) => ({
    ...w,
    sets: w.sets.map((s) => (s.id === setId ? { ...s, ...changes } : s)),
  }));
}

export function deleteSet(data, workoutId, setId) {
  return updateWorkout(data, workoutId, (w) => {
    const removed = w.sets.find((s) => s.id === setId);
    let n = 0;
    const sets = w.sets
      .filter((s) => s.id !== setId)
      .map((s) => (removed && s.exercise_id === removed.exercise_id ? { ...s, set_number: (n += 1) } : s));
    return { ...w, sets };
  });
}

export function finishWorkout(data, workoutId, { sessionRpe = null, painNote = null, now = Date.now() } = {}) {
  return updateWorkout(data, workoutId, (w) => ({
    ...w,
    session_rpe: sessionRpe,
    pain_note: painNote || null,
    finished_at: now,
    duration_min: w.started_at ? Math.max(1, Math.round((now - w.started_at) / 60000)) : w.duration_min,
  }));
}

/** Edit a finished workout's date, notes, duration or RPE (History page). */
export function editWorkout(data, workoutId, changes) {
  return updateWorkout(data, workoutId, (w) => ({ ...w, ...changes }));
}

export function deleteWorkout(data, workoutId) {
  return { ...data, workouts: data.workouts.filter((w) => w.id !== workoutId) };
}

/** Session types other than gym that are logged in one go (old site's Home,
 * Recovery, Cardio and Padel pages). */
export const SESSION_TYPES = ['home', 'recovery', 'cardio', 'padel'];

export function logSession(data, { date, type, label, durationMin = null, sessionRpe = null, result = null, notes = null, checklist = [], now = Date.now() }) {
  const id = nextId(data.workouts);
  let itemId = nextId(data.workouts.flatMap((w) => w.checklist_items || []));
  const workout = {
    id,
    log_date: date,
    workout_type: type,
    duration_min: durationMin,
    notes: notes ? `${label} · ${notes}` : label,
    session_rpe: sessionRpe,
    is_deload: false,
    pain_note: null,
    result,
    session_key: null,
    started_at: null,
    finished_at: now,
    sets: [],
    checklist_items: checklist.map((c) => ({ id: itemId++, workout_id: id, item_name: c.item_name, completed: !!c.completed, reps_achieved: c.reps_achieved ?? null })),
  };
  return { ...data, workouts: [...data.workouts, workout] };
}

export function workoutOn(data, date, type = 'gym') {
  return data.workouts.find((w) => w.log_date === date && w.workout_type === type) || null;
}

/** Sets of this exercise from the most recent earlier workout, for prefill. */
export function lastSets(data, exerciseId, beforeWorkoutId = null) {
  const workouts = data.workouts
    .filter((w) => w.id !== beforeWorkoutId && w.sets.some((s) => s.exercise_id === exerciseId))
    .sort((a, b) => (a.log_date === b.log_date ? b.id - a.id : a.log_date < b.log_date ? 1 : -1));
  if (!workouts.length) return [];
  return workouts[0].sets.filter((s) => s.exercise_id === exerciseId);
}

/** Epley estimated one-rep max. */
export function e1rm(weightKg, reps) {
  if (!weightKg || !reps) return 0;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/** Best set per exercise (by estimated 1RM), excluding one workout if given. */
export function personalBests(data, excludeWorkoutId = null) {
  const best = new Map();
  for (const w of data.workouts) {
    if (w.id === excludeWorkoutId) continue;
    for (const s of w.sets) {
      const score = e1rm(s.weight_kg, s.reps);
      const cur = best.get(s.exercise_id);
      if (!cur || score > cur.score) best.set(s.exercise_id, { ...s, score, log_date: w.log_date });
    }
  }
  return best;
}

export function isPersonalBest(data, workoutId, set) {
  const prev = personalBests(data, workoutId).get(set.exercise_id);
  const score = e1rm(set.weight_kg, set.reps);
  return score > 0 && (!prev || score > prev.score);
}

/** The weight to suggest for the next set of an exercise in a workout. */
export function suggestSet(data, workoutId, exerciseId, targetReps) {
  const workout = data.workouts.find((w) => w.id === workoutId);
  const done = workout ? workout.sets.filter((s) => s.exercise_id === exerciseId) : [];
  if (done.length) {
    const last = done[done.length - 1];
    return { weightKg: last.weight_kg, reps: last.reps };
  }
  const prev = lastSets(data, exerciseId, workoutId);
  if (prev.length) return { weightKg: prev[0].weight_kg, reps: prev[0].reps };
  return { weightKg: 0, reps: targetReps };
}

/** Every workout that has this exercise, newest first, with its sets. */
export function exerciseHistory(data, exerciseId) {
  return data.workouts
    .map((w) => ({ workoutId: w.id, log_date: w.log_date, label: w.notes, sets: w.sets.filter((s) => s.exercise_id === exerciseId) }))
    .filter((h) => h.sets.length)
    .sort((a, b) => (a.log_date === b.log_date ? b.workoutId - a.workoutId : a.log_date < b.log_date ? 1 : -1));
}

export function addCustomExercise(data, { name, muscle_group, equipment = null }) {
  const clean = name.trim();
  if (!clean || exerciseByName(data, clean)) return data;
  return { ...data, exercises: [...data.exercises, { id: nextId(data.exercises), name: clean, muscle_group, equipment, custom: true }] };
}

// ── Shopping list ticks (reset each Sunday-start week) ───────────────

export function shoppingChecked(data, week) {
  return new Set(data.shopping?.week === week ? data.shopping.checked : []);
}

export function toggleShopping(data, week, key) {
  const checked = shoppingChecked(data, week);
  if (checked.has(key)) checked.delete(key);
  else checked.add(key);
  return { ...data, shopping: { week, checked: [...checked] } };
}

// ── Meals, water, body ───────────────────────────────────────────────

export function mealLog(data, date, slot) {
  return data.meal_logs.find((m) => m.log_date === date && m.meal_slot === slot) || null;
}

export function setMeal(data, date, slot, changes) {
  const existing = mealLog(data, date, slot);
  if (existing) {
    return { ...data, meal_logs: data.meal_logs.map((m) => (m === existing ? { ...m, ...changes } : m)) };
  }
  const row = { id: nextId(data.meal_logs), log_date: date, meal_slot: slot, completed: false, option_key: null, drink_key: null, ...changes };
  return { ...data, meal_logs: [...data.meal_logs, row] };
}

export function waterOn(data, date) {
  return data.hydration_logs.filter((h) => h.log_date === date).reduce((sum, h) => sum + h.ml, 0);
}

export function addWater(data, date, ml) {
  const existing = data.hydration_logs.find((h) => h.log_date === date);
  if (existing) {
    const total = Math.max(0, existing.ml + ml);
    return { ...data, hydration_logs: data.hydration_logs.map((h) => (h === existing ? { ...h, ml: total } : h)) };
  }
  if (ml <= 0) return data;
  return { ...data, hydration_logs: [...data.hydration_logs, { id: nextId(data.hydration_logs), log_date: date, ml }] };
}

/** One weigh-in per date: logging again on the same day replaces it. */
export function logBody(data, entry) {
  const others = data.body_logs.filter((b) => b.log_date !== entry.log_date);
  const existing = data.body_logs.find((b) => b.log_date === entry.log_date);
  const row = { waist_cm: null, notes: null, sleep_hours: null, chest_cm: null, arm_cm: null, hips_cm: null, thigh_cm: null, ...existing, ...entry, id: existing ? existing.id : nextId(data.body_logs) };
  const body_logs = [...others, row].sort((a, b) => (a.log_date < b.log_date ? -1 : 1));
  return { ...data, body_logs };
}

export function deleteBody(data, id) {
  return { ...data, body_logs: data.body_logs.filter((b) => b.id !== id) };
}

export function latestWeight(data) {
  return data.body_logs.length ? data.body_logs[data.body_logs.length - 1] : null;
}

/** Days in a row, ending today or yesterday, with any workout logged. */
export function trainingStreak(data, today, isRestDay) {
  const trained = new Set(data.workouts.map((w) => w.log_date));
  let streak = 0;
  let d = today;
  if (!trained.has(d) && !isRestDay(d)) d = prev(d);
  for (let i = 0; i < 366; i += 1) {
    if (trained.has(d)) streak += 1;
    else if (!isRestDay(d)) break;
    d = prev(d);
  }
  return streak;
}

function prev(iso) {
  const [y, m, day] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, day - 1, 12);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
