import assert from 'node:assert/strict';
import test from 'node:test';

import { progressionTarget, repRange } from './progression.js';

const S = (kg, ...reps) => reps.map((r) => ({ weight_kg: kg, reps: r }));

test('rep ranges', () => {
  assert.deepEqual(repRange('8-10'), [8, 10]);
  assert.deepEqual(repRange('12'), [12, 12]);
  assert.equal(repRange('30s'), null);
});

test('first time asks for a starting weight', () => {
  const t = progressionTarget('8-10', 3, []);
  assert.equal(t.kind, 'start');
  assert.equal(t.reps, 8);
});

test('all sets at the top of the range adds weight and resets reps', () => {
  const t = progressionTarget('8-10', 3, [S(40, 10, 10, 10)]);
  assert.deepEqual([t.kind, t.weightKg, t.reps], ['add', 42.5, 8]);
  assert.match(t.reason, /3×10 at 40 kg/);
  assert.equal(progressionTarget('10-12', 2, [S(10, 12, 12)], { step: 1 }).weightKg, 11);
});

test('fewer sets than planned, or reps below the top, keeps the weight', () => {
  const t = progressionTarget('8-10', 3, [S(40, 10, 10)]);
  assert.equal(t.kind, 'repeat');
  const u = progressionTarget('8-10', 3, [S(40, 10, 9, 8)]);
  assert.deepEqual([u.kind, u.weightKg, u.reps], ['repeat', 40, 9]);
});

test('missing the bottom of the range twice suggests a 10% deload', () => {
  const t = progressionTarget('8-10', 3, [S(50, 8, 7, 6), S(50, 8, 7, 7)]);
  assert.deepEqual([t.kind, t.weightKg], ['deload', 45]);
  assert.equal(progressionTarget('8-10', 3, [S(50, 8, 7, 6), S(47.5, 9, 9, 8)]).kind, 'repeat');
});

test('warm-up sets at lighter weights are ignored', () => {
  const t = progressionTarget('8-10', 2, [[...S(20, 10), ...S(40, 10, 10)]]);
  assert.equal(t.kind, 'add');
});
