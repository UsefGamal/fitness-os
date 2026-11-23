import { test } from 'node:test';
import assert from 'node:assert/strict';

import { backAction, gymModeOn, inGymMode, runningWorkout, setGymMode } from './gymMode.js';

const base = (extra = {}) => ({ settings: {}, workouts: [{ id: 7, finished_at: null, paused_at: null }], ...extra });

const off = (extra = {}) => setGymMode(base(extra), false);

test('on by default; the switch turns it off and on and keeps other training settings', () => {
  assert.equal(gymModeOn(base()), true);
  assert.equal(gymModeOn(off()), false);
  const d = setGymMode(base({ settings: { training: { auto_rest: false } } }), true);
  assert.equal(gymModeOn(d), true);
  assert.equal(d.settings.training.auto_rest, false);
  assert.equal(gymModeOn(setGymMode(d, false)), false);
  assert.equal(gymModeOn(setGymMode(d, 'yes')), false);
});

test('only on the workout screen with a running, unpaused workout', () => {
  const on = setGymMode(base(), true);
  assert.equal(inGymMode(on, 7, '/workout'), true);
  assert.equal(inGymMode(on, 7, '/'), false);
  assert.equal(inGymMode(on, null, '/workout'), false);
  assert.equal(inGymMode(on, 8, '/workout'), false);
  assert.equal(inGymMode({ ...on, workouts: [{ id: 7, finished_at: '2026-11-15T08:00:00' }] }, 7, '/workout'), false);
  assert.equal(inGymMode({ ...on, workouts: [{ id: 7, finished_at: null, paused_at: 123 }] }, 7, '/workout'), false);
  assert.equal(inGymMode(off(), 7, '/workout'), false);
});

test('Back pauses in gym mode and does the usual thing otherwise', () => {
  const on = setGymMode(base(), true);
  assert.equal(backAction(on, 7, '/workout'), 'pause');
  assert.equal(backAction(on, 7, '/plan'), 'default');
  assert.equal(backAction(off(), 7, '/workout'), 'default');
});

test('runningWorkout copes with missing data', () => {
  assert.equal(runningWorkout(undefined, 1), null);
  assert.equal(runningWorkout({}, 1), null);
});
