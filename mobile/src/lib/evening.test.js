import assert from 'node:assert/strict';
import test from 'node:test';

import { eveningDone, eveningOn, EVENING_OPTIONS, setEvening } from './evening.js';

test('evening sessions are set per weekday and cleared', () => {
  let d = { workouts: [] };
  d = setEvening(d, 'wednesday', 'tabata');
  assert.equal(eveningOn(d, '2026-11-04').label, 'Tabata'); // a Wednesday
  assert.equal(eveningOn(d, '2026-11-05'), null);
  assert.equal(eveningOn(setEvening(d, 'wednesday', null), '2026-11-04'), null);
  assert.ok(EVENING_OPTIONS.find((o) => o.key === 'recovery'));
});

test('an evening session counts as done once logged', () => {
  const opt = { label: 'Tabata' };
  assert.equal(eveningDone({ workouts: [{ log_date: '2026-11-04', workout_type: 'cardio', notes: 'Tabata' }] }, '2026-11-04', opt), true);
  assert.equal(eveningDone({ workouts: [{ log_date: '2026-11-04', workout_type: 'gym', notes: 'Tabata' }] }, '2026-11-04', opt), false);
});
