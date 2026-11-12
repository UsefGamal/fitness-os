import assert from 'node:assert/strict';
import test from 'node:test';

import { badges, countPrs, fullMealWeeks, liftRatios, newBadges, recordBadges } from './achievements.js';

const exercises = [{ id: 1, name: 'Bench', muscle_group: 'Chest' }];
const w = (id, log_date, weight) => ({ id, log_date, workout_type: 'gym', sets: [{ id, exercise_id: 1, weight_kg: weight, reps: 5 }] });

test('a set that beats every earlier one counts as a PR', () => {
  const data = { exercises, workouts: [w(1, '2026-10-01', 60), w(2, '2026-10-08', 65), w(3, '2026-10-15', 62), w(4, '2026-10-22', 70)], body_logs: [] };
  assert.equal(countPrs(data), 2);
});

test('badges are earned from the data and recorded once', () => {
  const data = { exercises, workouts: [w(1, '2026-10-01', 60), w(2, '2026-10-08', 65)], body_logs: [] };
  const all = badges(data, '2026-11-04');
  assert.equal(all.find((b) => b.id === 'first').earned, true);
  assert.equal(all.find((b) => b.id === 'pr1').earned, true);
  assert.equal(all.find((b) => b.id === 'w10').fraction, 0.2);
  const fresh = newBadges(data, '2026-11-04').map((b) => b.id);
  assert.ok(fresh.includes('first'));
  const kept = recordBadges(data, fresh, '2026-11-04');
  assert.deepEqual(newBadges(kept, '2026-11-04'), []);
  assert.equal(badges(kept, '2026-11-04').find((b) => b.id === 'first').date, '2026-11-04');
});

test('bodyweight lifts, weight and waist drops, full meal weeks', () => {
  const data = {
    exercises: [{ id: 1, name: 'Barbell Bench Press', muscle_group: 'Chest' }, { id: 2, name: 'Bulgarian Split Squat', muscle_group: 'Legs' }, { id: 3, name: 'Barbell Squat', muscle_group: 'Legs' }],
    workouts: [{ id: 1, log_date: '2026-10-01', workout_type: 'gym', sets: [{ id: 1, exercise_id: 1, weight_kg: 80, reps: 1 }, { id: 2, exercise_id: 2, weight_kg: 200, reps: 1 }, { id: 3, exercise_id: 3, weight_kg: 100, reps: 1 }] }],
    body_logs: [{ log_date: '2026-09-01', weight_kg: 86, waist_cm: 95 }, { log_date: '2026-10-01', weight_kg: 80, waist_cm: 91 }],
    meal_logs: [],
  };
  assert.deepEqual(liftRatios(data), { bench: 1, squat: 1.25, deadlift: 0 });
  const b = Object.fromEntries(badges(data, '2026-11-04').map((x) => [x.id, x]));
  assert.equal(b.bench1.earned, true);
  assert.equal(b.squat15.earned, false);
  assert.equal(b.lost5.earned, true);
  assert.equal(b.waist5.value, 4);
  const meals = [];
  for (let d = 1; d <= 7; d += 1) for (const slot of ['a', 'b', 'c', 'd', 'e']) meals.push({ log_date: `2026-11-0${d}`, meal_slot: slot, completed: true });
  assert.equal(fullMealWeeks({ meal_logs: meals }), 1);
  assert.equal(fullMealWeeks({ meal_logs: meals.slice(1) }), 0);
});

// REW-1
test('the 5 kg badge is only for a weight-loss goal; "On the scale" is gone', () => {
  const body = { exercises, workouts: [], meal_logs: [], body_logs: [{ log_date: '2026-09-01', weight_kg: 86, waist_cm: 95 }, { log_date: '2026-10-01', weight_kg: 80, waist_cm: 91 }] };
  const ids = (direction) => badges({ ...body, goals: [{ id: 'g1', set_on: '2026-09-01', direction, ended_on: null }] }, '2026-11-04').map((b) => b.id);
  assert.ok(ids('lose').includes('lost5'));
  for (const direction of ['gain', 'recomp', 'maintain']) assert.ok(!ids(direction).includes('lost5'), direction);
  assert.ok(ids('recomp').includes('waist5'));
  assert.ok(!ids('lose').includes('weigh30'));
  assert.equal(badges(body, '2026-11-04').find((b) => b.id === 'meals7').label, 'Every meal ticked');
  // A badge recorded before stays in the data; it is just not shown.
  const kept = { ...body, achievements: { weigh30: '2026-10-01' } };
  assert.equal(newBadges(kept, '2026-11-04').some((b) => b.id === 'weigh30'), false);
  assert.equal(kept.achievements.weigh30, '2026-10-01');
});
