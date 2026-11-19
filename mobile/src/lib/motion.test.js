import assert from 'node:assert/strict';
import test from 'node:test';

import { countAt, easeOut, fillTone, restEnding, restQuiet } from './motion.js';

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

test('fillTone: gold at the target, amber past it, nothing before', () => {
  assert.equal(fillTone(0, 2000), '');
  assert.equal(fillTone(1500, 2000), '');
  assert.equal(fillTone(2000, 2000), 'full');
  assert.equal(fillTone(2150, 2000), 'full');
  assert.equal(fillTone(2300, 2000), 'over');
  assert.equal(fillTone(300, 155, { overAt: Infinity }), 'full');
  assert.equal(fillTone(10, 0), '');
});

test('restEnding: the last 10 seconds of a running rest', () => {
  assert.equal(restEnding(11), false);
  assert.equal(restEnding(10), true);
  assert.equal(restEnding(1), true);
  assert.equal(restEnding(0), false);
  assert.equal(restEnding(5, false), false);
});
