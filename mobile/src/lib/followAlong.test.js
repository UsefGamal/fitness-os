import assert from 'node:assert/strict';
import test from 'node:test';

import { followSteps, moveName, startOf, timing } from './followAlong.js';

test('times come from the line, else the default hold', () => {
  assert.deepEqual(timing('5 min hamstring & hip flexor stretch'), { seconds: 300, sides: 1 });
  assert.deepEqual(timing('15-20 min easy walk'), { seconds: 900, sides: 1 });
  assert.deepEqual(timing('Chest doorway stretch, 30s/side'), { seconds: 30, sides: 2 });
  assert.deepEqual(timing('Wall Slide 1x10'), { seconds: 30, sides: 1 });
  assert.deepEqual(timing('Wall Slide 1x10', 45), { seconds: 45, sides: 1 });
});

test('names drop the amounts', () => {
  assert.equal(moveName('Wall Slide 1x10'), 'Wall Slide');
  assert.equal(moveName('Chest doorway stretch, 30s/side'), 'Chest doorway stretch');
  assert.equal(moveName('Arm circles x10 each direction'), 'Arm circles');
});

test('both sides become two steps; startOf adds up earlier steps', () => {
  const steps = followSteps(['Overhead lat stretch, 30s/side', '5 min deep breathing']);
  assert.deepEqual(steps.map((s) => [s.seconds, s.side || '']), [[30, 'Left side'], [30, 'Right side'], [300, '']]);
  assert.equal(startOf(steps, 2), 60);
  assert.equal(startOf(steps, 0), 0);
});
