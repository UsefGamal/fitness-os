import assert from 'node:assert/strict';
import test from 'node:test';

import { isBodyweight, jumpFor, progressionTarget, repRange, stepFor } from './progression.js';

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

// TRAIN-1: right numbers on day one.
test('the step fits the move: 1 kg isolation, 2 kg dumbbells, 2.5 kg barbells and machines', () => {
  assert.equal(stepFor({ mechanic: 'isolation', equipment: 'dumbbell' }), 1);
  assert.equal(stepFor({ mechanic: 'compound', equipment: 'dumbbell' }), 2);
  assert.equal(stepFor({ mechanic: 'compound', equipment: 'kettlebells' }), 2);
  assert.equal(stepFor({ mechanic: 'compound', equipment: 'barbell' }), 2.5);
  assert.equal(stepFor({ mechanic: 'compound', equipment: 'machine' }), 2.5);
  // No library entry: as before.
  assert.equal(stepFor(null, { barbell: true }), 2.5);
  assert.equal(stepFor(null), 1);
});

test('a jump is never much more than 10% of the load, and never under 1 kg', () => {
  assert.equal(jumpFor(60, 2.5), 2.5);
  assert.equal(jumpFor(20, 2.5), 2.5);
  assert.equal(jumpFor(10, 2.5), 1); // a light machine or EZ bar
  assert.equal(jumpFor(12, 2), 1);
  assert.equal(jumpFor(20, 2), 2);
  assert.equal(jumpFor(30, 2), 2);
  assert.equal(jumpFor(8, 1), 1);
  assert.equal(jumpFor(5, 2), 1);
  assert.equal(jumpFor(0, 2.5), 1);
  const t = progressionTarget('8-10', 3, [S(12, 10, 10, 10)], { step: 2 });
  assert.deepEqual([t.kind, t.weightKg, t.reps], ['add', 13, 8]);
  assert.match(t.reason, /add 1 kg/);
});

test('a bodyweight move progresses by reps, then a harder version, never by kg', () => {
  const up = progressionTarget('8-12', 3, [S(0, 10, 9, 8)], { bodyweight: true });
  assert.deepEqual([up.kind, up.weightKg, up.reps], ['repeat', 0, 9]);
  assert.doesNotMatch(up.reason, /kg|same weight/);
  const top = progressionTarget('8-12', 3, [S(0, 12, 12, 12)], { bodyweight: true });
  assert.deepEqual([top.kind, top.weightKg, top.reps], ['harder', 0, 12]);
  assert.match(top.reason, /3×12, all at the top of 8-12: try a harder version/);
  assert.doesNotMatch(top.reason, /kg/);
  // Unknown move only ever logged at 0 kg: the same.
  assert.equal(progressionTarget('8-12', 3, [S(0, 12, 12, 12)]).kind, 'harder');
  // Sets saved without a weight count as 0 kg.
  assert.equal(progressionTarget('8-12', 2, [[{ weight_kg: null, reps: 12 }, { weight_kg: null, reps: 12 }]], { bodyweight: true }).kind, 'harder');
  // A weighted pull-up is a loaded move again.
  const belt = progressionTarget('6-8', 2, [S(10, 8, 8)], { step: 2.5, bodyweight: true });
  assert.deepEqual([belt.kind, belt.weightKg], ['add', 11]);
  // A move that takes weight, logged at 0 kg, still gets a first small jump.
  assert.deepEqual([progressionTarget('8-10', 2, [S(0, 10, 10)], { step: 2, bodyweight: false }).kind, progressionTarget('8-10', 2, [S(0, 10, 10)], { step: 2, bodyweight: false }).weightKg], ['add', 1]);
  assert.equal(isBodyweight({ equipment: 'body only' }), true);
  assert.equal(isBodyweight({ equipment: 'barbell' }), false);
  assert.equal(isBodyweight(null), false);
});
