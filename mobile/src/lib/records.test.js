import assert from 'node:assert/strict';
import test from 'node:test';

import { records } from './records.js';

const set = (id, kg, reps, extra = {}) => ({ id, exercise_id: 1, weight_kg: kg, reps, is_warmup: false, ...extra });
const data = (workouts) => ({ exercises: [{ id: 1, name: 'Bench Press' }], workouts });

test('no weighted work set, no records', () => {
  assert.equal(records(data([]), 1), null);
  assert.equal(records(data([{ id: 1, log_date: '2026-11-01', sets: [set(1, 40, 10, { is_warmup: true })] }]), 1), null);
});

test('records come from work sets only, each with its date', () => {
  const r = records(data([
    { id: 1, log_date: '2026-11-01', sets: [set(1, 60, 8), set(2, 60, 8), set(3, 100, 3, { is_warmup: true })] },
    { id: 2, log_date: '2026-11-05', sets: [set(4, 70, 5), set(5, 50, 15)] },
  ]), 1);
  assert.deepEqual(r.heaviest, { kg: 70, reps: 5, date: '2026-11-05' });
  assert.equal(r.e1rm.from.kg, 70); // 70x5 = 81.7 beats 60x8 = 76
  assert.equal(r.e1rm.kg, 81.7);
  assert.deepEqual(r.setVolume, { kg: 750, from: { kg: 50, reps: 15 }, date: '2026-11-05' });
  assert.deepEqual(r.session, { kg: 1100, date: '2026-11-05' }); // 350 + 750 vs 960
});

test('a 15-rep set counts for volume and rep bests but not the 1RM estimate', () => {
  const r = records(data([{ id: 1, log_date: '2026-11-01', sets: [set(1, 50, 15)] }]), 1);
  assert.equal(r.e1rm, null);
  assert.equal(r.repMax[9].actual.kg, 50); // 10 reps done at 50
  assert.equal(r.repMax[0].estimated, null);
});

test('the rep-max table: actual is the heaviest done for at least that many reps', () => {
  const r = records(data([{ id: 1, log_date: '2026-11-01', sets: [set(1, 100, 1), set(2, 80, 6)] }]), 1);
  assert.equal(r.repMax[0].actual.kg, 100);
  assert.equal(r.repMax[5].actual.kg, 80);
  assert.equal(r.repMax[6].actual, null);
  assert.equal(r.repMax[0].estimated, r.e1rm.kg);
  assert.ok(r.repMax[9].estimated < r.repMax[1].estimated);
});
