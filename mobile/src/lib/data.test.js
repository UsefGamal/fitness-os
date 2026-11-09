import assert from 'node:assert/strict';
import test from 'node:test';

import * as D from './data.js';
import { content } from './testContent.js';

const fresh = () => D.emptyData(content);

test('the exercise library is seeded once with unique ids', () => {
  const d = fresh();
  assert.equal(d.exercises.length, new Set(d.exercises.map((e) => e.name)).size);
  assert.deepEqual(D.seedExercises(content, d.exercises), d.exercises);
});

test('logging sets numbers them per exercise and finishing records duration', () => {
  const ex = D.exerciseByName(fresh(), 'Leg Press');
  let { data, workoutId } = D.startWorkout(fresh(), { date: '2026-11-02', sessionKey: 'lower', label: 'Lower' });
  data = D.addSet(data, workoutId, { exerciseId: ex.id, reps: 10, weightKg: 100 });
  data = D.addSet(data, workoutId, { exerciseId: ex.id, reps: 9, weightKg: 100 });
  const w = data.workouts[0];
  assert.deepEqual(w.sets.map((s) => s.set_number), [1, 2]);
  assert.notEqual(w.sets[0].id, w.sets[1].id);
  data = D.deleteSet(data, workoutId, w.sets[0].id);
  assert.deepEqual(data.workouts[0].sets.map((s) => [s.set_number, s.reps]), [[1, 9]]);
  data = D.finishWorkout(data, workoutId, { sessionRpe: 8, now: w.started_at + 55 * 60000 });
  assert.equal(data.workouts[0].duration_min, 55);
  assert.equal(data.workouts[0].session_rpe, 8);
});

test('suggestions prefill from this session, then from last time', () => {
  const ex = D.exerciseByName(fresh(), 'Leg Press');
  let { data, workoutId: first } = D.startWorkout(fresh(), { date: '2026-10-26', sessionKey: 'lower', label: 'Lower' });
  assert.deepEqual(D.suggestSet(data, first, ex.id, 10), { weightKg: 0, reps: 10 });
  data = D.addSet(data, first, { exerciseId: ex.id, reps: 10, weightKg: 90 });
  let second;
  ({ data, workoutId: second } = D.startWorkout(data, { date: '2026-11-02', sessionKey: 'lower', label: 'Lower' }));
  assert.deepEqual(D.suggestSet(data, second, ex.id, 8), { weightKg: 90, reps: 10 });
  data = D.addSet(data, second, { exerciseId: ex.id, reps: 8, weightKg: 95 });
  assert.deepEqual(D.suggestSet(data, second, ex.id, 8), { weightKg: 95, reps: 8 });
  assert.equal(D.isPersonalBest(data, second, data.workouts[1].sets[0]), true);
  assert.equal(D.isPersonalBest(data, second, { exercise_id: ex.id, reps: 5, weight_kg: 90 }), false);
});

test('the first set of a new exercise is a baseline, not a best (E7-S2)', () => {
  let data = fresh();
  const ex = data.exercises[0];
  const r = D.startWorkout(data, { date: '2026-11-04', sessionKey: 'upper', label: 'Upper' });
  data = r.data;
  const set = { exercise_id: ex.id, reps: 10, weight_kg: 40 };
  assert.equal(D.setKind(data, r.workoutId, set), 'baseline');
  assert.equal(D.isPersonalBest(data, r.workoutId, set), false);
  data = D.addSet(data, r.workoutId, { exerciseId: ex.id, reps: 10, weightKg: 40 });
  assert.equal(D.setKind(data, r.workoutId, { ...set, weight_kg: 45 }), null, 'one baseline per exercise');
  assert.equal(D.setKind(data, r.workoutId, { ...set, weight_kg: 0 }), null);
});

test('meals, water and one weigh-in per day', () => {
  let d = D.setMeal(fresh(), '2026-11-04', 'breakfast', { completed: true, option_key: 'option_b' });
  d = D.setMeal(d, '2026-11-04', 'breakfast', { completed: false });
  assert.equal(d.meal_logs.length, 1);
  assert.equal(d.meal_logs[0].option_key, 'option_b');
  d = D.addWater(d, '2026-11-04', 500);
  d = D.addWater(d, '2026-11-04', -750);
  assert.equal(D.waterOn(d, '2026-11-04'), 0);
  d = D.logBody(d, { log_date: '2026-11-04', weight_kg: 82 });
  d = D.logBody(d, { log_date: '2026-11-04', weight_kg: 81.6 });
  d = D.logBody(d, { log_date: '2026-11-01', weight_kg: 82.4 });
  assert.deepEqual(d.body_logs.map((b) => b.weight_kg), [82.4, 81.6]);
  assert.equal(D.latestWeight(d).weight_kg, 81.6);
});

test('streak counts training days and skips rest days', () => {
  let d = fresh();
  for (const date of ['2026-11-01', '2026-11-02', '2026-11-04']) d = D.startWorkout(d, { date, sessionKey: 'x', label: 'x' }).data;
  const rest = (iso) => iso === '2026-11-03' || iso === '2026-10-31';
  assert.equal(D.trainingStreak(d, '2026-11-04', rest), 3);
  assert.equal(D.trainingStreak(d, '2026-11-05', rest), 3);
  assert.equal(D.trainingStreak(d, '2026-11-06', rest), 0);
});

test('exercise history, custom exercises, editing a workout and modules', () => {
  let d = fresh();
  const ex = D.exerciseByName(d, 'Leg Press');
  let a; ({ data: d, workoutId: a } = D.startWorkout(d, { date: '2026-10-26', sessionKey: 'lower', label: 'Lower' }));
  d = D.addSet(d, a, { exerciseId: ex.id, reps: 10, weightKg: 90 });
  let b; ({ data: d, workoutId: b } = D.startWorkout(d, { date: '2026-11-02', sessionKey: 'lower', label: 'Lower' }));
  d = D.addSet(d, b, { exerciseId: ex.id, reps: 8, weightKg: 95 });
  assert.deepEqual(D.exerciseHistory(d, ex.id).map((h) => h.log_date), ['2026-11-02', '2026-10-26']);
  d = D.editWorkout(d, a, { log_date: '2026-10-27' });
  assert.equal(d.workouts.find((w) => w.id === a).log_date, '2026-10-27');
  const n = d.exercises.length;
  d = D.addCustomExercise(d, { name: '  Sled Push ', muscle_group: 'Legs' });
  d = D.addCustomExercise(d, { name: 'Sled Push', muscle_group: 'Legs' });
  assert.equal(d.exercises.length, n + 1);
  assert.equal(D.moduleOn(d, 'meals'), true);
  d = { ...d, settings: { ...d.settings, modules: { ...d.settings.modules, meals: false } } };
  assert.equal(D.moduleOn(d, 'meals'), false);
});

test('logSession records a finished non-gym session with its checklist', () => {
  const d = D.logSession(D.emptyData(content), {
    date: '2026-11-04', type: 'recovery', label: 'Recovery', durationMin: 30,
    checklist: [{ item_name: 'Walk', completed: true }, { item_name: 'Stretch', completed: false }],
  });
  const w = d.workouts[0];
  assert.equal(w.workout_type, 'recovery');
  assert.ok(w.finished_at);
  assert.deepEqual(w.checklist_items.map((c) => [c.item_name, c.completed, c.workout_id]), [['Walk', true, w.id], ['Stretch', false, w.id]]);
  assert.equal(D.workoutOn(d, '2026-11-04'), null); // still no gym workout that day
});

test('shopping ticks belong to one week and reset the next', () => {
  let d = D.toggleShopping(fresh(), '2026-11-01', 'boiled_egg|unit');
  assert.ok(D.shoppingChecked(d, '2026-11-01').has('boiled_egg|unit'));
  assert.equal(D.shoppingChecked(d, '2026-11-08').size, 0);
  d = D.toggleShopping(d, '2026-11-01', 'boiled_egg|unit');
  assert.equal(D.shoppingChecked(d, '2026-11-01').size, 0);
});

// F-00: one work-set rule and a rep cap on the e1RM estimate.
test('isWorkSet leaves out warm-ups by flag or by set type', () => {
  assert.equal(D.isWorkSet({ reps: 5, weight_kg: 60, is_warmup: false }), true);
  assert.equal(D.isWorkSet({ reps: 5, weight_kg: 20, is_warmup: true }), false);
  assert.equal(D.isWorkSet({ reps: 5, weight_kg: 20, set_type: 'warmup' }), false);
  assert.equal(D.isWorkSet(null), false);
});

test('e1rm counts reps only up to 12', () => {
  assert.equal(D.e1rm(100, 12), D.e1rm(100, 25));
  assert.ok(D.e1rm(100, 12) > D.e1rm(100, 11));
  assert.equal(D.e1rm(100, 1), 100);
});

test('a warm-up is never a best, a baseline or a prefill', () => {
  const d = { ...fresh(), exercises: [{ id: 1, name: 'Bench Press', muscle_group: 'Chest' }], workouts: [
    { id: 1, log_date: '2026-11-01', workout_type: 'gym', sets: [{ id: 1, exercise_id: 1, set_number: 1, reps: 8, weight_kg: 60, is_warmup: false }] },
    { id: 2, log_date: '2026-11-03', workout_type: 'gym', sets: [{ id: 2, exercise_id: 1, set_number: 1, reps: 5, weight_kg: 100, is_warmup: true }] },
  ] };
  assert.equal(D.personalBests(d).get(1).weight_kg, 60);
  assert.equal(D.setKind(d, 2, d.workouts[1].sets[0]), null);
  assert.equal(D.lastSets(d, 1)[0].weight_kg, 60);
});
