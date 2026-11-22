import assert from 'node:assert/strict';
import test from 'node:test';

import { EFFORT, logBarMode, startMode } from './workoutFlow.js';

test('Start on Home starts at once unless there is something to read first', () => {
  assert.equal(startMode({ notes: false }), 'go');
  assert.equal(startMode({ notes: true }), 'preview');
});

test('the bottom bar logs the next set, then finishes, and gives way to the timer', () => {
  assert.equal(logBarMode({ resting: false, finishing: false, done: 2, target: 13, canLog: true }), 'log');
  assert.equal(logBarMode({ resting: false, finishing: false, done: 2, target: 13, canLog: false }), null);
  assert.equal(logBarMode({ resting: false, finishing: false, done: 13, target: 13, canLog: false }), 'finish');
  assert.equal(logBarMode({ resting: false, finishing: false, done: 14, target: 13, canLog: true }), 'finish');
  assert.equal(logBarMode({ resting: true, finishing: false, done: 2, target: 13, canLog: true }), null);
  assert.equal(logBarMode({ resting: false, finishing: true, done: 13, target: 13, canLog: true }), null);
  assert.equal(logBarMode({ resting: false, finishing: false, done: 0, target: 0, canLog: true }), 'log');
});

test('effort chips are Skip plus four points on the 1-10 scale', () => {
  assert.deepEqual(EFFORT.map((e) => e.value), ['', '4', '6', '8', '10']);
});
