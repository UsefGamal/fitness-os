import assert from 'node:assert/strict';
import test from 'node:test';

import { countAt, easeOut, restQuiet } from './motion.js';

test('count-up starts at from, lands on to, never overshoots', () => {
  assert.equal(countAt(0, 120, 0), 0);
  assert.equal(countAt(0, 120, 450), 120);
  assert.equal(countAt(0, 120, 9999), 120);
  for (let t = 0; t <= 450; t += 30) assert.ok(countAt(0, 120, t) <= 120);
  assert.equal(easeOut(2), 1);
});

test('rewards stay quiet only in the last 3 s of a running rest', () => {
  const now = 1_000_000;
  assert.equal(restQuiet(null, now), false);
  assert.equal(restQuiet(now + 10_000, now), false);
  assert.equal(restQuiet(now + 2_000, now), true);
  assert.equal(restQuiet(now - 1, now), false);
});
