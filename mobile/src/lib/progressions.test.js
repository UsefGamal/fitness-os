import assert from 'node:assert/strict';
import test from 'node:test';

import { exerciseIdFor, ladderFor, ladderRows, neighbours } from './progressions.js';
import { content } from './testContent.js';

const LADDERS = content.training.progressions;

test('finds the ladder and step, ignoring case and spaces', () => {
  const hit = ladderFor('  push-UP ', LADDERS);
  assert.equal(hit.ladder.key, 'push');
  assert.equal(hit.ladder.steps[hit.index].name, 'Push-up');
  assert.equal(ladderFor('Bench Press', LADDERS), null);
  assert.equal(ladderFor('', LADDERS), null);
  assert.equal(ladderFor('Push-up', undefined), null);
});

test('neighbours are the steps either side, null at the ends', () => {
  const mid = neighbours('Push-up', LADDERS);
  assert.equal(mid.easier.name, 'Knee Push-up');
  assert.equal(mid.harder.name, 'Decline Push-up');
  const bottom = neighbours('Wall Push-up', LADDERS);
  assert.equal(bottom.easier, null);
  assert.equal(bottom.harder.name, 'Incline Push-up');
  const top = neighbours('Pull-up', LADDERS);
  assert.equal(top.harder, null);
  assert.equal(neighbours('Leg Press', LADDERS), null);
});

test('rows mark easier, current and harder steps with a level from 1', () => {
  const { ladder, index } = ladderFor('Bodyweight Squat', LADDERS);
  const rows = ladderRows(ladder, index);
  assert.deepEqual(rows.map((r) => r.place), ['easier', 'current', 'harder', 'harder', 'harder']);
  assert.deepEqual(rows.map((r) => r.level), [1, 2, 3, 4, 5]);
  assert.deepEqual(ladderRows(null, 0), []);
});

test('a step links to the library exercise of the same name', () => {
  const exercises = [{ id: 4, name: 'Push-up', muscle_group: 'Chest' }, { id: 9, name: 'plank', muscle_group: 'Core' }];
  assert.equal(exerciseIdFor('Push-up', exercises), 4);
  assert.equal(exerciseIdFor('Plank', exercises), 9);
  assert.equal(exerciseIdFor('Archer Push-up', exercises), null);
  assert.equal(exerciseIdFor('Push-up', undefined), null);
});

test('every move the home plan uses that is on a ladder has a step to go to', () => {
  for (const day of content.training.home_program) {
    for (const ex of day.exercises) {
      const n = neighbours(ex.name, LADDERS);
      if (n) assert.ok(n.easier || n.harder, ex.name);
    }
  }
});
