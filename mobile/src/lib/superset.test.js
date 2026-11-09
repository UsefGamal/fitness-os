import assert from 'node:assert/strict';
import test from 'node:test';

import { groupOf, roundDone, roundRest } from './superset.js';

const day = [
  { name: 'Bench', sets: 3 },
  { name: 'Curl', sets: 4, pair: 'A' },
  { name: 'Extension', sets: 3, pair: 'A' },
  { name: 'Calf', sets: 3, pair: 'B' },
];

test('a pair is found by its letter; a lone exercise is its own group', () => {
  assert.deepEqual(groupOf(day, 1), [1, 2]);
  assert.deepEqual(groupOf(day, 2), [1, 2]);
  assert.deepEqual(groupOf(day, 0), [0]);
  assert.deepEqual(groupOf(day, 3), [3]);
});

test('no rest between partners, rest once the round is complete', () => {
  assert.equal(roundDone(day, [0, 1, 0, 0], 1), false); // curl 1, extension owes 1
  assert.equal(roundDone(day, [0, 1, 1, 0], 2), true); // extension 1 ends round 1
  assert.equal(roundDone(day, [0, 2, 1, 0], 1), false);
  assert.equal(roundDone(day, [0, 2, 2, 0], 2), true);
});

test('a partner with fewer sets stops owing once it has done all of its own', () => {
  assert.equal(roundDone(day, [0, 4, 3, 0], 1), true); // curl's 4th set: extension is finished
});

test('lone exercises rest after every set', () => {
  assert.equal(roundDone(day, [1, 0, 0, 0], 0), true);
  assert.equal(roundDone(day, [0, 0, 0, 1], 3), true);
});

test('the round rest is the longest in the group, not the sum', () => {
  const rests = [120, 60, 90, 45];
  assert.equal(roundRest(day, 1, (j) => rests[j]), 90);
  assert.equal(roundRest(day, 0, (j) => rests[j]), 120);
});
