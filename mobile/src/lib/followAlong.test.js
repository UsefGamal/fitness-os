import assert from 'node:assert/strict';
import test from 'node:test';

import { amountOf, followShadeLines, followSteps, moveName, startOf, timing } from './followAlong.js';

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

test('the line under the name drops the name', () => {
  const [a] = followSteps(['Rotator Cuff 1x10-12']);
  assert.equal(amountOf(a), '1x10-12');
  const [b] = followSteps(['Chest doorway stretch, 30s/side']);
  assert.equal(amountOf(b), '30s/side');
  const [c] = followSteps(['Cat cow']);
  assert.equal(amountOf(c), '');
});

test('followShadeLines: the move now, how far along, and what is next', () => {
  const steps = followSteps(['Arm circles 30s', 'Hip openers, 20s/side']);
  assert.deepEqual(followShadeLines(steps, 0, 'Upper A warm-up'), { label: 'Arm circles', detail: '1 of 3 · Next: Hip openers (left side)', progress: 'Upper A warm-up' });
  assert.equal(followShadeLines(steps, 2, 'x').detail, '3 of 3 · Last one');
  assert.equal(followShadeLines(steps, 3, 'x'), null);
});
