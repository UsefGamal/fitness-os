import assert from 'node:assert/strict';
import test from 'node:test';

import * as P from './planEdit.js';
import { emptyData } from './data.js';
import { content } from './testContent.js';

const T = content.training;
const fresh = () => emptyData(content);

test("unedited days are the trainer's plan", () => {
  const day = P.effectiveDay('lower', T, fresh());
  assert.equal(day.edited, false);
  assert.equal(day.exercises[0].name, 'Leg Press');
});

test('edits are per session and reset brings the trainer plan back', () => {
  let d = P.editExercise(fresh(), 'lower', T, 0, { sets: 4, reps: '6-8', rest: '3m' });
  let lower = P.effectiveDay('lower', T, d);
  assert.equal(lower.edited, true);
  assert.deepEqual([lower.exercises[0].sets, lower.exercises[0].reps, lower.exercises[0].rest_sec], [4, '6-8', 180]);
  assert.equal(P.effectiveDay('upper', T, d).edited, false);
  d = P.resetDay(d, 'lower');
  assert.equal(P.effectiveDay('lower', T, d).exercises[0].sets, T.program[1].exercises[0].sets);
  assert.equal(P.isEdited('lower', d), false);
});

test('swap keeps the slot settings and remembers the original', () => {
  const d = P.swapExercise(fresh(), 'lower', T, 0, 'Hack Squat');
  const ex = P.effectiveDay('lower', T, d).exercises[0];
  assert.equal(ex.name, 'Hack Squat');
  assert.equal(ex.sets, T.program[1].exercises[0].sets);
  assert.equal(ex.swapped_from, 'Leg Press');
  assert.equal(ex.video, undefined);
});

test('add, move and remove; removing half a pair unpairs the other', () => {
  const push = T.program.find((x) => x.key === 'push');
  const pairIdx = push.exercises.findIndex((e) => e.pair);
  let d = P.addExercise(fresh(), 'push', T, 'Dips');
  let list = P.effectiveDay('push', T, d).exercises;
  assert.equal(list.at(-1).name, 'Dips');
  d = P.moveExercise(d, 'push', T, list.length - 1, -1);
  assert.equal(P.effectiveDay('push', T, d).exercises.at(-2).name, 'Dips');
  if (pairIdx >= 0) {
    const letter = push.exercises[pairIdx].pair[0];
    d = P.removeExercise(d, 'push', T, pairIdx);
    list = P.effectiveDay('push', T, d).exercises;
    assert.ok(!list.some((e) => e.pair && e.pair[0] === letter));
  }
});
