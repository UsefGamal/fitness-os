import assert from 'node:assert/strict';
import test from 'node:test';

import { readNumber, setRows, stopwatch, workoutKcal, workoutVolume } from './liveStats.js';

test('volume counts work sets only', () => {
  const sets = [
    { weight_kg: 60, reps: 10 },
    { weight_kg: 20, reps: 12, set_type: 'warmup' },
    { weight_kg: 40, reps: 8, is_warmup: true },
    { weight_kg: 0, reps: 45, track: 'time' },
    { weight_kg: 62.5, reps: 8, set_type: 'drop' },
  ];
  assert.equal(workoutVolume(sets), 1100);
  assert.equal(workoutVolume([]), 0);
  assert.equal(workoutVolume(undefined), 0);
});

test('kcal: 5 METs × body weight × hours, 75 kg without a weigh-in', () => {
  assert.equal(workoutKcal(3600000, 100), 500);
  assert.equal(workoutKcal(30 * 60000, null), 188);
  assert.equal(workoutKcal(-5, 80), 0);
});

test('stopwatch shows mm:ss, then h:mm:ss', () => {
  assert.equal(stopwatch(0), '00:00');
  assert.equal(stopwatch(66000), '01:06');
  assert.equal(stopwatch(3723000), '1:02:03');
});

test('set rows: logged sets, then open rows, the first one next', () => {
  const rows = setRows(['a', 'b'], 4);
  assert.deepEqual(rows.map((r) => [r.kind, r.n, r.kind === 'open' ? r.next : null]), [['done', 1, null], ['done', 2, null], ['open', 3, true], ['open', 4, false]]);
  assert.equal(setRows(['a', 'b', 'c'], 2).length, 3, 'extra sets stay, no open row');
  assert.equal(setRows([], 0).length, 0);
});

test('typed numbers', () => {
  assert.equal(readNumber('22,5'), 22.5);
  assert.equal(readNumber(' 10 ', { whole: true }), 10);
  assert.equal(readNumber('9.6', { whole: true }), 10);
  assert.equal(readNumber(''), null);
  assert.equal(readNumber('abc'), null);
  assert.equal(readNumber('-3'), null);
  assert.equal(readNumber('900', { max: 500 }), 500);
});
