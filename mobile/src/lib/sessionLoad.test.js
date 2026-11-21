// Sessions without sets as light sets (sessionLoad.js).
import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData, logSession } from './data.js';
import { cardioMinutes, HOME_SETS, MAX_SPORT_SETS, sessionLoads, sessionMuscles, sportSets } from './sessionLoad.js';
import { content } from './testContent.js';

const T = content.training;
const one = (fields) => logSession(emptyData(content), { date: '2026-11-18', ...fields }).workouts[0];

test('cardio and sport muscles come from the name or the type', () => {
  assert.deepEqual(sessionMuscles({ workout_type: 'padel', notes: 'Padel' }, T).main, ['quadriceps', 'glutes', 'calves']);
  assert.ok(sessionMuscles({ workout_type: 'cardio', notes: 'Stationary bike' }, T).main.includes('quadriceps'));
  assert.ok(sessionMuscles({ workout_type: 'cardio', notes: 'Rowing machine' }, T).main.includes('lats'));
  assert.ok(sessionMuscles({ workout_type: 'cardio', notes: 'Incline Treadmill Walk' }, T).main.includes('glutes'));
  assert.equal(sessionMuscles({ workout_type: 'cardio', notes: 'Something else' }, T), null);
});

test('light sets grow with minutes, up to a cap', () => {
  assert.equal(sportSets(5), 0);
  assert.equal(sportSets(20), 1);
  assert.equal(sportSets(30), 1.5);
  assert.equal(sportSets(90), MAX_SPORT_SETS);
  assert.equal(sportSets(null), 0);
});

test('padel and cardio load their muscles', () => {
  const padel = sessionLoads(one({ type: 'padel', label: 'Padel', durationMin: 90 }), T);
  assert.equal(padel.length, 1);
  assert.equal(padel[0].sets, 3);
  assert.ok(padel[0].target.helpers.includes('forearms'));
  const bike = sessionLoads(one({ type: 'cardio', label: 'Stationary bike', durationMin: 40 }), T);
  assert.equal(bike[0].sets, 2);
  // No minutes written: the usual length for that kind.
  assert.equal(sessionLoads(one({ type: 'padel', label: 'Padel' }), T)[0].sets, 3);
});

test('interval rounds are half a set for their move', () => {
  const w = one({ type: 'cardio', label: 'Tabata', durationMin: 6, intervals: { preset: 'tabata', rounds: 8 },
    checklist: [{ item_name: 'Jump Squat', completed: true, reps_achieved: 4 }, { item_name: 'Push-up', completed: true, reps_achieved: 4 }, { item_name: 'Nope', completed: true, reps_achieved: 2 }] });
  const loads = sessionLoads(w, T);
  assert.equal(loads.length, 2);
  assert.deepEqual(loads[0].target.main, ['quadriceps', 'glutes']);
  assert.equal(loads[0].sets, 2);
});

test('a ticked home exercise counts; untouched ones and recovery do not', () => {
  const w = one({ type: 'home', label: 'Upper A', checklist: [{ item_name: 'Push-up · 12-20', completed: true }, { item_name: 'Pike Push-up · 8-12', completed: false }, { item_name: '5 min walk', completed: true }] });
  const loads = sessionLoads(w, T);
  assert.equal(loads.length, 1);
  assert.equal(loads[0].sets, HOME_SETS);
  assert.deepEqual(sessionLoads(one({ type: 'recovery', label: 'Recovery', durationMin: 30 }), T), []);
  assert.deepEqual(sessionLoads({ workout_type: 'gym', sets: [{}] }, T), []);
  assert.deepEqual(sessionLoads(null, T), []);
});

test('cardio minutes in a week', () => {
  const ws = [
    { log_date: '2026-11-16', workout_type: 'cardio', duration_min: 25 },
    { log_date: '2026-11-17', workout_type: 'padel', duration_min: 90 },
    { log_date: '2026-11-17', workout_type: 'gym', duration_min: 60 },
    { log_date: '2026-11-10', workout_type: 'cardio', duration_min: 30 },
  ];
  assert.equal(cardioMinutes(ws, '2026-11-15', '2026-11-21'), 115);
  assert.equal(cardioMinutes(null, '2026-11-15', '2026-11-21'), 0);
});
