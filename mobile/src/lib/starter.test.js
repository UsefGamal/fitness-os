import assert from 'node:assert/strict';
import test from 'node:test';

import { howToSteps, showHowTo, starterJustDone, starterProgress, STARTER_SESSIONS } from './starter.js';

const beginner = (workouts = [], exercises = []) => ({ settings: { training: { level: 'beginner' } }, workouts, exercises });
const gym = (id, finished = true, sets = []) => ({ id, workout_type: 'gym', finished_at: finished ? `2026-11-${String(id).padStart(2, '0')}T08:00:00Z` : null, sets });

test('a beginner sees Session n of 6 until six sessions are finished', () => {
  assert.deepEqual(starterProgress(beginner()), { done: 0, total: 6, next: 1 });
  assert.deepEqual(starterProgress(beginner([gym(1), gym(2, false)])), { done: 1, total: 6, next: 2 });
  assert.equal(starterProgress(beginner(Array.from({ length: STARTER_SESSIONS }, (_, i) => gym(i + 1)))), null);
});

test('only finished gym sessions count, and only for beginners', () => {
  const other = { id: 9, workout_type: 'cardio', finished_at: '2026-11-09T08:00:00Z', sets: [] };
  assert.equal(starterProgress(beginner([other])).done, 0);
  assert.equal(starterProgress({ settings: { training: { level: 'intermediate' } }, workouts: [] }), null);
  assert.equal(starterProgress({ workouts: [] }), null, 'no level set: someone who used the app before levels existed');
  assert.equal(starterProgress({}), null);
});

test('starterJustDone is true only for the sixth finished session', () => {
  const six = beginner(Array.from({ length: 6 }, (_, i) => gym(i + 1)));
  assert.equal(starterJustDone(six, 6), true);
  assert.equal(starterJustDone(six, 5), false);
  const seven = beginner(Array.from({ length: 7 }, (_, i) => gym(i + 1)));
  assert.equal(starterJustDone(seven, 7), false);
  assert.equal(starterJustDone(beginner([gym(1)]), 1), false);
  assert.equal(starterJustDone({ ...six, settings: {} }, 6), false);
});

test('how-to shows the first time a beginner meets an exercise', () => {
  const exercises = [{ id: 1, name: 'Leg Press' }, { id: 2, name: 'Plank' }];
  const d = beginner([gym(1, true, [{ exercise_id: 1, reps: 10 }])], exercises);
  assert.equal(showHowTo(d, 'Leg Press'), false);
  assert.equal(showHowTo(d, 'Plank'), true);
  assert.equal(showHowTo(d, 'Never Seen'), true);
  assert.equal(showHowTo({ ...d, settings: { training: { level: 'expert' } } }, 'Plank'), false);
});

test('howToSteps strips numbering and keeps the first few', () => {
  const entry = { instructions: ['1. Sit down.', '2. Push.', '', 'Lower slowly.', 'Repeat.', 'Rest.'] };
  assert.deepEqual(howToSteps(entry), ['Sit down.', 'Push.', 'Lower slowly.']);
  assert.deepEqual(howToSteps(entry, 2), ['Sit down.', 'Push.']);
  assert.deepEqual(howToSteps(null), []);
  assert.deepEqual(howToSteps({}), []);
});
