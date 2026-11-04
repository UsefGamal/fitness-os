import assert from 'node:assert/strict';
import test from 'node:test';

import { addExtraSet, applyTweaks, exerciseNote, moveBy, setExerciseNote, skipToEnd, swapFor } from './tweaks.js';

const day = { key: 'push', exercises: [{ name: 'A', sets: 3, video: 'v' }, { name: 'B', sets: 2 }, { name: 'C', sets: 4 }] };
const names = (d) => d.exercises.map((e) => e.name).join('');

test('no tweaks: the plan as is, with original indexes', () => {
  const d = applyTweaks(day, null);
  assert.equal(names(d), 'ABC');
  assert.deepEqual(d.exercises.map((e) => e.orig), [0, 1, 2]);
});

test('skip moves an exercise to the end, move swaps neighbours', () => {
  let t = skipToEnd(null, 3, 0);
  assert.equal(names(applyTweaks(day, t)), 'BCA');
  t = moveBy(t, 3, 2, -1);
  assert.equal(names(applyTweaks(day, t)), 'BAC');
  assert.equal(names(applyTweaks(day, moveBy(t, 3, 0, -1))), 'BAC');
});

test('extra sets and swaps follow the exercise, not its position', () => {
  let t = addExtraSet(null, 3, 1);
  t = skipToEnd(t, 3, 1);
  t = swapFor(t, 3, 0, 'Z');
  const d = applyTweaks(day, t);
  assert.equal(names(d), 'ZCB');
  assert.equal(d.exercises[2].sets, 3);
  assert.equal(d.exercises[0].swapped_from, 'A');
  assert.equal(d.exercises[0].video, null);
  assert.equal(names(applyTweaks(day, swapFor(t, 3, 0, null))), 'ACB');
});

test('a plan that grew keeps the old order and appends the new exercise', () => {
  const t = skipToEnd(null, 2, 0); // made when the plan had A, B
  assert.equal(names(applyTweaks(day, t)), 'BAC');
});

test('exercise notes are trimmed and cleared when empty', () => {
  let d = setExerciseNote({}, 'Leg Press', '  seat 5  ');
  assert.equal(exerciseNote(d, 'Leg Press'), 'seat 5');
  d = setExerciseNote(d, 'Leg Press', ' ');
  assert.equal(exerciseNote(d, 'Leg Press'), '');
});
