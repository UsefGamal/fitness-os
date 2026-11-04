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
