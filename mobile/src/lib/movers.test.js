import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays } from './dates.js';
import { sparkLine, strengthMovers } from './movers.js';

const TODAY = '2026-11-19';
const w = (id, ago, sets, extra = {}) => ({ id, log_date: addDays(TODAY, -ago), sets, ...extra });
const s = (exercise_id, weight_kg, reps, extra = {}) => ({ exercise_id, weight_kg, reps, ...extra });

const data = {
  exercises: [{ id: 1, name: 'Bench' }, { id: 2, name: 'Row' }, { id: 3, name: 'Curl' }, { id: 4, name: 'Plank' }, { id: 5, name: 'New lift' }],
  workouts: [
    w(1, 50, [s(1, 60, 8), s(2, 70, 10), s(3, 30, 10), s(4, 20, 60, { track: 'time' })]),
    w(2, 40, [s(1, 60, 8), s(2, 70, 10), s(3, 30, 10), s(4, 20, 60, { track: 'time' })]),
    w(3, 20, [s(1, 65, 8), s(2, 70, 10), s(3, 27.5, 10), s(5, 40, 8)]),
    w(4, 6, [s(1, 67.5, 8), s(2, 70, 10.2), s(3, 27.5, 10), s(1, 100, 8, { is_warmup: true })]),
    w(5, 3, [s(1, 120, 8)], { is_deload: true }),
  ],
};

test('strengthMovers: 4 weeks against the 4 before, deloads and holds out', () => {
  const m = strengthMovers(data, TODAY);
  assert.deepEqual(m.counts, { up: 1, held: 1, down: 1 });
  assert.equal(m.waiting, 1); // New lift: one session only
  assert.deepEqual(m.rows.map((r) => [r.name, r.outcome]), [['Bench', 'up'], ['Curl', 'down'], ['Row', 'held']]);
  const bench = m.rows[0];
  assert.equal(bench.kg, 9.5); // e1RM 85.5 against 76
  assert.equal(bench.spark.length, 8);
  assert.equal(bench.spark.filter(Boolean).length, 4);
});

test('strengthMovers with nothing to judge', () => {
  assert.deepEqual(strengthMovers({ exercises: [], workouts: [] }, TODAY), { counts: { up: 0, held: 0, down: 0 }, waiting: 0, rows: [] });
});

test('sparkLine skips gaps and needs 2 points', () => {
  assert.equal(sparkLine([null, 5, null]), null);
  assert.equal(sparkLine([1, null, 3], 10, 10, 0), 'M0.0,10.0 L10.0,0.0');
  assert.equal(sparkLine([2, 2], 10, 10, 0), 'M0.0,5.0 L10.0,5.0');
});
