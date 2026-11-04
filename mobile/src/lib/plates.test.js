import assert from 'node:assert/strict';
import test from 'node:test';

import { isBarbell, nearestLoadable, plateText, platesPerSide, warmupSets } from './plates.js';

test('plates per side, biggest first', () => {
  assert.deepEqual(platesPerSide(100, 20), { plates: [25, 15], loaded: 100, exact: true });
  assert.deepEqual(platesPerSide(62.5, 20).plates, [20, 1.25]);
  assert.deepEqual(platesPerSide(20, 20).plates, []);
});

test('only the plates you own', () => {
  const r = platesPerSide(100, 20, [20, 10, 5]);
  assert.deepEqual(r.plates, [20, 20]);
  assert.equal(r.exact, true);
  const odd = platesPerSide(63, 20, [20, 10, 5, 2.5]);
  assert.equal(odd.exact, false);
  assert.equal(odd.loaded, 60);
});

test('nearest loadable weight', () => {
  assert.equal(nearestLoadable(63, 20, [20, 10, 5, 2.5]), 65);
  assert.equal(nearestLoadable(61, 20, [20, 10, 5, 2.5]), 60);
  assert.equal(nearestLoadable(10, 20), 20);
});

test('plate text groups the same size', () => {
  assert.equal(plateText([20, 20, 2.5]), '2×20 + 2.5');
  assert.equal(plateText([]), 'Empty bar');
});

test('warm-ups ramp to the working weight', () => {
  assert.deepEqual(warmupSets(100, 20), [{ kg: 40, reps: 8, pct: 40 }, { kg: 60, reps: 5, pct: 60 }, { kg: 80, reps: 3, pct: 80 }]);
  assert.deepEqual(warmupSets(30, 20).map((w) => w.kg), [20, 25]);
  assert.deepEqual(warmupSets(20, 20), []);
});

test('barbell lifts by equipment or name', () => {
  assert.equal(isBarbell('Back Squat'), true);
  assert.equal(isBarbell('Lateral Raise'), false);
  assert.equal(isBarbell('Anything', { equipment: 'dumbbell' }), false);
  assert.equal(isBarbell('Curl', { equipment: 'e-z curl bar' }), true);
});
