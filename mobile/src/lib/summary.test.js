import assert from 'node:assert/strict';
import test from 'node:test';

import { isShortSession, workoutSummary } from './summary.js';

const set = (id, ex, kg, reps, extra = {}) => ({ id, exercise_id: ex, weight_kg: kg, reps, is_warmup: false, ...extra });
const data = (workouts) => ({ exercises: [{ id: 1, name: 'Bench Press' }, { id: 2, name: 'Row' }], workouts });

test('a session is short under half the planned sets', () => {
  assert.equal(isShortSession(1, 18), true);
  assert.equal(isShortSession(8, 18), true);
  assert.equal(isShortSession(9, 18), false);
  assert.equal(isShortSession(0, 0), false);
});

test('no workout, no summary', () => {
  assert.equal(workoutSummary(data([]), 7), null);
});

test('summary counts work sets, total lifted and time', () => {
  const s = workoutSummary(data([
    { id: 1, log_date: '2026-11-10', finished_at: 1, duration_min: 52, sets: [set(1, 1, 40, 10, { is_warmup: true }), set(2, 1, 60, 8), set(3, 2, 50, 10)] },
  ]), 1);
  assert.equal(s.durationMin, 52);
  assert.equal(s.sets, 2);
  assert.equal(s.volumeKg, 980);
  assert.deepEqual(s.bests, []); // first time: a baseline, not a best
  assert.equal(s.weekSessions, 1);
});

test('a best is the top set that beats earlier workouts, once per exercise', () => {
  const s = workoutSummary(data([
    { id: 1, log_date: '2026-11-03', finished_at: 1, sets: [set(1, 1, 60, 8), set(2, 2, 50, 10)] },
    { id: 2, log_date: '2026-11-10', finished_at: 2, sets: [set(3, 1, 62.5, 8), set(4, 1, 65, 8), set(5, 2, 50, 10)] },
  ]), 2);
  assert.deepEqual(s.bests, [{ name: 'Bench Press', kg: 65, reps: 8 }]);
});

test('week sessions count finished days from Sunday to Saturday', () => {
  const s = workoutSummary(data([
    { id: 1, log_date: '2026-11-07', finished_at: 1, sets: [] }, // Saturday, the week before
    { id: 2, log_date: '2026-11-08', finished_at: 2, sets: [] }, // Sunday
    { id: 3, log_date: '2026-11-10', finished_at: 3, sets: [] },
    { id: 4, log_date: '2026-11-10', finished_at: 4, sets: [] }, // same day counts once
    { id: 5, log_date: '2026-11-11', finished_at: null, sets: [] }, // not finished
  ]), 3);
  assert.equal(s.weekSessions, 2);
});
