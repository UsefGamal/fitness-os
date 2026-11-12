import assert from 'node:assert/strict';
import test from 'node:test';

import { HOLD, holdDelay, stepValue } from './hold.js';

test('a hold waits, repeats steadily, then speeds up', () => {
  assert.equal(holdDelay(0), HOLD.startMs);
  assert.equal(holdDelay(1), HOLD.slowMs);
  assert.equal(holdDelay(HOLD.fastAfter - 1), HOLD.slowMs);
  assert.equal(holdDelay(HOLD.fastAfter), HOLD.fastMs);
  assert.equal(holdDelay(500), HOLD.fastMs);
  assert.ok(HOLD.startMs >= 300, 'a normal tap must stay one step');
});

test('stepValue clamps and rounds, and survives a broken value', () => {
  assert.equal(stepValue(22.5, 2.5, { max: 400, decimals: 1 }), 25);
  assert.equal(stepValue(0.1, 0.2, { decimals: 1 }), 0.3);
  assert.equal(stepValue(0, -1), 0);
  assert.equal(stepValue(999, 5, { max: 1000 }), 1000);
  assert.equal(stepValue(NaN, 1), 1);
  assert.equal(stepValue(5, -10, { min: 1 }), 1);
});
