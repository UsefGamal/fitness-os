import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_HOLD_REPS, DEFAULT_LIFT_REPS, isHoldName, repsForSwap } from './holds.js';

test('planks, wall sits and hangs are holds; moving variants are not', () => {
  for (const n of ['Plank', 'Side Plank', 'Bear Plank', 'Wall Sit', 'Hollow Body Hold', 'Dead Hang', 'Copenhagen Plank']) assert.equal(isHoldName(n), true, n);
  for (const n of ['Plank Shoulder Taps', 'Plank Jacks', 'Bench Press', 'Dead Bug', 'Lat Pulldown', 'Plank to Push-up', '']) assert.equal(isHoldName(n), false, n);
});

test('swapping a lift for a hold gives seconds, and back gives reps', () => {
  assert.equal(repsForSwap('8-10', 'Plank'), DEFAULT_HOLD_REPS);
  assert.equal(repsForSwap('45-60s', 'Bench Press'), DEFAULT_LIFT_REPS);
  // Like for like keeps the slot's own numbers.
  assert.equal(repsForSwap('45-60s', 'Side Plank'), '45-60s');
  assert.equal(repsForSwap('6-8', 'Leg Press'), '6-8');
});
