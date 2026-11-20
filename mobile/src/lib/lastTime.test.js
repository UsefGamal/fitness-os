import assert from 'node:assert/strict';
import test from 'node:test';

import { compareToLast, lastSession, lastTimePreview, liftOutcome, setChange, setsOf, setsText, topSet } from './lastTime.js';

const set = (exercise_id, weight_kg, reps, extra = {}) => ({ exercise_id, weight_kg, reps, ...extra });
const data = {
  exercises: [],
  workouts: [
    { id: 1, log_date: '2026-11-05', session_key: 'pull', finished_at: 1, sets: [set(1, 60, 8), set(1, 60, 7), set(2, 70, 10), set(3, 0, 45, { track: 'time', duration_s: 45 })] },
    { id: 2, log_date: '2026-11-12', session_key: 'pull', finished_at: 1, sets: [set(1, 60, 8), set(1, 60, 8), set(2, 72.5, 10), set(3, 0, 50, { track: 'time', duration_s: 50 }), set(9, 20, 10, { is_warmup: true })] },
    { id: 3, log_date: '2026-11-14', session_key: 'push', finished_at: 1, sets: [set(5, 50, 8)] },
    { id: 4, log_date: '2026-11-19', session_key: 'pull', finished_at: null, sets: [set(1, 60, 9), set(1, 60, 8), set(2, 72.5, 10), set(3, 0, 40, { track: 'time', duration_s: 40 }), set(4, 30, 10)] },
  ],
};

test('lastSession finds the latest finished run of the same session', () => {
  assert.equal(lastSession(data, 'pull', '2026-11-19', 4).id, 2);
  assert.equal(lastSession(data, 'pull', '2026-11-10').id, 1);
  assert.equal(lastSession(data, 'legs', '2026-11-19'), null);
  assert.equal(lastSession(data, null, '2026-11-19'), null);
});

test('setChange: kg first, then reps, then seconds for holds', () => {
  assert.deepEqual(setChange(set(1, 60, 8), set(1, 60, 9)), { kind: 'reps', diff: 1 });
  assert.deepEqual(setChange(set(1, 60, 8), set(1, 62.5, 7)), { kind: 'kg', diff: 2.5 });
  assert.deepEqual(setChange(set(1, 60, 8), set(1, 60, 8)), { kind: 'same', diff: 0 });
  assert.deepEqual(setChange(set(3, 0, 50, { track: 'time', duration_s: 50 }), set(3, 0, 40, { track: 'time', duration_s: 40 })), { kind: 'secs', diff: -10 });
  assert.equal(setChange(null, set(1, 60, 8)), null);
});

test('liftOutcome: under 2% is held', () => {
  assert.equal(liftOutcome([set(1, 60, 8)], [set(1, 60, 9)]), 'up');
  assert.equal(liftOutcome([set(1, 100, 8)], [set(1, 100, 8)]), 'held');
  assert.equal(liftOutcome([set(1, 100, 8)], [set(1, 97.5, 8)]), 'down');
  assert.equal(liftOutcome([set(3, 0, 50, { track: 'time', duration_s: 50 })], [set(3, 0, 40, { track: 'time', duration_s: 40 })]), 'down');
  assert.equal(liftOutcome([], [set(1, 60, 8)]), null);
});

test('topSet picks the best load set, else the longest hold', () => {
  assert.equal(topSet([set(1, 60, 8), set(1, 65, 6), set(1, 50, 12)]).weight_kg, 65);
  assert.equal(topSet([set(3, 0, 40, { track: 'time', duration_s: 40 }), set(3, 0, 55, { track: 'time', duration_s: 55 })]).duration_s, 55);
  assert.deepEqual(setsOf(data.workouts[1], 9), []); // warm-ups never count
});

test('compareToLast counts up, held and down against the last same session', () => {
  const r = compareToLast(data, data.workouts[3]);
  assert.equal(r.last.id, 2);
  assert.deepEqual(r.counts, { up: 1, held: 1, down: 1 });
  assert.deepEqual(r.rows.map((x) => [x.exercise_id, x.outcome]), [[1, 'up'], [2, 'held'], [3, 'down'], [4, null]]);
});

test('setsText reads like a gym notebook', () => {
  assert.equal(setsText([set(1, 60, 8), set(1, 60, 8), set(1, 60, 7)]), '60 × 8, 8, 7');
  assert.equal(setsText([set(1, 60, 8), set(1, 57.5, 7)]), '60 × 8, 57.5 × 7');
  assert.equal(setsText([set(3, 0, 45, { track: 'time', duration_s: 45 }), set(3, 0, 50, { track: 'time', duration_s: 50 })]), '45 s, 50 s');
  assert.equal(setsText([set(6, 0, 12), set(6, 0, 10)]), '12, 10');
  assert.equal(setsText([]), '');
});

test('lastTimePreview gives the last run before today, first lifts first', () => {
  const d = { ...data, exercises: [{ id: 1, name: 'Lat Pulldown' }, { id: 2, name: 'Row' }] };
  const p = lastTimePreview(d, 'pull', '2026-11-19');
  assert.equal(p.date, '2026-11-12');
  assert.equal(p.sets, 4);
  assert.deepEqual(p.lifts, [{ exercise_id: 1, name: 'Lat Pulldown', text: '60 × 8, 8' }, { exercise_id: 2, name: 'Row', text: '72.5 × 10' }]);
  assert.equal(lastTimePreview(d, 'legs', '2026-11-19'), null);
});
