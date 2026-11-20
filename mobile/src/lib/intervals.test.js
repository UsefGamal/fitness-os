// Interval sessions with moves (intervals.js).
import assert from 'node:assert/strict';
import test from 'node:test';

import { intervalLines, intervalLog, MAX_MOVES, moveAt, movePool, nextMove, presetMoves, roundsDone, toggleMove, workBefore } from './intervals.js';
import { content } from './testContent.js';
import { INTERVAL_PRESETS, intervalSteps } from './training.js';

const T = content.training;
const tabata = INTERVAL_PRESETS.find((p) => p.key === 'tabata');
const steps = intervalSteps(tabata); // warm-up 60, 8 x (20 work, 10 rest) minus last rest, cool-down 60
const moves = ['Jump Squat', 'Push-up', 'Star Jump'];

test('every preset starts with moves the timer offers', () => {
  for (const p of INTERVAL_PRESETS) {
    const ms = presetMoves(T, p.key);
    assert.ok(ms.length, p.key);
    for (const m of ms) assert.ok(movePool(T).includes(m), m);
    for (const m of ms) assert.ok(T.exercise_targets[m], `${m} has muscles`);
    for (const m of ms) assert.ok(T.exercise_photos[m], `${m} has a photo`);
  }
  assert.deepEqual(presetMoves(T, 'custom'), []);
  assert.deepEqual(presetMoves(null, 'hiit'), []);
});

test('moves take turns, one per work round', () => {
  assert.equal(steps[0].kind, 'warmup');
  assert.equal(moveAt(steps, 0, moves), null);
  assert.equal(moveAt(steps, 1, moves), 'Jump Squat');
  assert.equal(moveAt(steps, 2, moves), null); // a rest
  assert.equal(moveAt(steps, 3, moves), 'Push-up');
  assert.equal(moveAt(steps, 5, moves), 'Star Jump');
  assert.equal(moveAt(steps, 7, moves), 'Jump Squat'); // starts over
  assert.equal(moveAt(steps, 1, []), null);
  assert.equal(workBefore(steps, 7), 3);
  assert.equal(nextMove(steps, 0, moves), 'Jump Squat');
  assert.equal(nextMove(steps, 2, moves), 'Push-up');
  assert.equal(nextMove(steps, steps.length - 1, moves), null);
});

test('what the screen and the notification say', () => {
  assert.deepEqual(intervalLines(steps, 1, moves), { title: 'Jump Squat', detail: 'Round 1 of 8 · Next: Rest 0:10' });
  assert.deepEqual(intervalLines(steps, 2, moves), { title: 'Rest', detail: 'Next: Push-up' });
  assert.deepEqual(intervalLines(steps, 0, moves), { title: 'Warm up', detail: 'Next: Jump Squat' });
  assert.equal(intervalLines(steps, 1, []).title, 'Work');
  assert.equal(intervalLines(steps, steps.length - 1, moves).title, 'Cool down');
  const last = steps.length - 2; // round 8, then the cool-down
  assert.match(intervalLines(steps, last, moves).detail, /^Round 8 of 8 · Next: Cool down 1:00$/);
  const sets = intervalSteps({ ...tabata, sets: 2, setRest: 30 });
  assert.match(intervalLines(sets, 1, moves, { sets: 2 }).detail, /set 1 of 2/);
  assert.equal(intervalLines(steps, 99, moves), null);
});

test('a round counts once half of it is done', () => {
  assert.deepEqual(roundsDone(steps, 60, moves), { rounds: 0, byMove: [] });
  assert.equal(roundsDone(steps, 69, moves).rounds, 0);
  assert.equal(roundsDone(steps, 70, moves).rounds, 1);
  const all = roundsDone(steps, 10_000, moves);
  assert.equal(all.rounds, 8);
  assert.deepEqual(all.byMove, [['Jump Squat', 3], ['Push-up', 3], ['Star Jump', 2]]);
  assert.deepEqual(roundsDone(steps, 10_000, []).byMove, []);
});

test('what gets saved', () => {
  assert.equal(intervalLog({ config: tabata, moves, steps, elapsedS: 30 }), null);
  const log = intervalLog({ config: tabata, moves, steps, elapsedS: 6 * 60 });
  assert.equal(log.type, 'cardio');
  assert.equal(log.label, 'Tabata');
  assert.equal(log.durationMin, 6);
  assert.deepEqual(log.intervals, { preset: 'tabata', rounds: 8, work_s: 20, rest_s: 10 });
  assert.deepEqual(log.checklist[0], { item_name: 'Jump Squat', completed: true, reps_achieved: 3 });
});

test('adding and taking out moves', () => {
  assert.deepEqual(toggleMove(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleMove(['a', 'b'], 'a'), ['b']);
  const full = Array.from({ length: MAX_MOVES }, (_, i) => `m${i}`);
  assert.equal(toggleMove(full, 'x'), full);
});
