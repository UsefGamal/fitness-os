import assert from 'node:assert/strict';
import test from 'node:test';

import { groupOf, pairedWithNext, pairWithNext, roundDone, roundRest, unpair } from './superset.js';

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

const plain = [
  { name: 'Bench', sets: 3, type: 'normal' },
  { name: 'Row', sets: 3, type: 'normal' },
  { name: 'Curl', sets: 3, type: 'normal' },
  { name: 'Pushdown', sets: 3, type: 'normal' },
];

test('pair an exercise with the next one, with the first free letter', () => {
  const a = pairWithNext(plain, 0);
  assert.deepEqual(a.map((e) => e.pair ?? null), ['A', 'A', null, null]);
  assert.equal(a[0].type, 'paired');
  assert.ok(pairedWithNext(a, 0));
  assert.ok(!pairedWithNext(a, 1));
  const b = pairWithNext(a, 2);
  assert.deepEqual(b.map((e) => e.pair ?? null), ['A', 'A', 'B', 'B']);
  assert.deepEqual(groupOf(b, 3), [2, 3]);
});

test('pairing onto a superset makes a tri-set; the next one leaves its old pair', () => {
  const ab = pairWithNext(pairWithNext(plain, 0), 2); // A A B B
  const tri = pairWithNext(ab, 1); // Row + Curl: Curl leaves B, Pushdown is alone again
  assert.deepEqual(tri.map((e) => e.pair ?? null), ['A', 'A', 'A', null]);
  assert.equal(tri[3].type, 'normal');
  assert.equal(pairWithNext(tri, 0), tri, 'already together: no change');
  assert.equal(pairWithNext(plain, 3), plain, 'the last one has no next');
});

test('unpair: a partner left alone is a normal exercise again', () => {
  const a = pairWithNext(plain, 0);
  const u = unpair(a, 1);
  assert.deepEqual(u.map((e) => e.pair ?? null), [null, null, null, null]);
  assert.ok(u.every((e) => e.type === 'normal' && !('pair' in e)));
  assert.equal(unpair(plain, 0), plain);
  const tri = pairWithNext(a, 1);
  assert.deepEqual(unpair(tri, 2).map((e) => e.pair ?? null), ['A', 'A', null, null], 'two left stay a pair');
});
