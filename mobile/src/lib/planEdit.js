// Your own version of the trainer's plan. The trainer's plan in content/
// is the starter plan and never changes; edits are stored per session in
// data.plan_overrides[key] as a full exercise list, and "Reset" deletes
// the override. Same idea as openGym's starter plans with editable
// routines, written for this data shape.
import { programDay } from './schedule.js';

export const DEFAULT_REST = '1.5m';

export function effectiveDay(key, training, data) {
  const day = programDay(key, training);
  if (!day) return null;
  const override = data?.plan_overrides?.[key];
  return override ? { ...day, exercises: override, edited: true } : { ...day, edited: false };
}

export function isEdited(key, data) {
  return Boolean(data?.plan_overrides?.[key]);
}

function withExercises(data, key, training, fn) {
  const current = effectiveDay(key, training, data).exercises;
  const next = fn(current.map((e) => ({ ...e })));
  return { ...data, plan_overrides: { ...(data.plan_overrides || {}), [key]: next } };
}

function restSec(rest) {
  const m = /^\s*(\d+(?:\.\d+)?)(?:-\d+(?:\.\d+)?)?\s*([ms])/.exec(rest || '');
  if (!m) return 90;
  return m[2] === 'm' ? Math.round(Number(m[1]) * 60) : Math.round(Number(m[1]));
}

/** Change sets, reps or rest of the exercise at `index`. */
export function editExercise(data, key, training, index, changes) {
  return withExercises(data, key, training, (list) => {
    const ex = { ...list[index], ...changes };
    if ('rest' in changes) ex.rest_sec = restSec(changes.rest);
    list[index] = ex;
    return list;
  });
}

/** Put another exercise in this slot, keeping its sets, reps, rest and pair. */
export function swapExercise(data, key, training, index, name) {
  return withExercises(data, key, training, (list) => {
    const old = list[index];
    list[index] = { name, sets: old.sets, reps: old.reps, rest: old.rest, rest_sec: old.rest_sec, rir: old.rir, type: old.type, pair: old.pair, swapped_from: old.swapped_from || old.name };
    return list;
  });
}

export function addExercise(data, key, training, name, { sets = 3, reps = '10-12', rest = DEFAULT_REST } = {}) {
  return withExercises(data, key, training, (list) => [...list, { name, sets, reps, rest, rest_sec: restSec(rest), type: 'normal' }]);
}

export function removeExercise(data, key, training, index) {
  return withExercises(data, key, training, (list) => {
    const [gone] = list.splice(index, 1);
    // A pair can't be half a pair.
    if (gone?.pair) {
      return list.map((e) => (e.pair && e.pair[0] === gone.pair[0] ? { ...e, pair: undefined, type: 'normal' } : e));
    }
    return list;
  });
}

export function moveExercise(data, key, training, index, delta) {
  return withExercises(data, key, training, (list) => {
    const to = index + delta;
    if (to < 0 || to >= list.length) return list;
    [list[index], list[to]] = [list[to], list[index]];
    return list;
  });
}

export function resetDay(data, key) {
  const rest = { ...(data.plan_overrides || {}) };
  delete rest[key];
  return { ...data, plan_overrides: rest };
}
