// Stats > Overview (charts step 4).
import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays } from './dates.js';
import { keptWhileCutting, weeklyDays } from './overview.js';

const TODAY = '2026-11-19'; // Thursday; this week started Sunday 15 Nov
const base = { profile: { week_start: 'sun' }, program: { blocks: [] }, exercises: [{ id: 1, name: 'Bench' }, { id: 2, name: 'Squat' }, { id: 3, name: 'Curl' }], body_logs: [], goals: [{ direction: 'lose' }] };
const wk = (date, sets, extra = {}) => ({ id: date + sets.length, log_date: date, sets, ...extra });
const set = (id, kg, reps = 5) => ({ exercise_id: id, weight_kg: kg, reps, is_warmup: false });

test('weeklyDays counts distinct days per week, oldest first, and marks recovery weeks', () => {
  const data = { ...base, workouts: [
    wk('2026-11-16', []), wk('2026-11-16', []), wk('2026-11-17', []), // this week: 2 days
    wk('2026-11-10', [], { is_deload: true }),
    wk('2026-11-20', []), // tomorrow
  ] };
  const w = weeklyDays(data, TODAY);
  assert.equal(w.length, 12);
  assert.equal(w[11].week, '2026-11-15');
  assert.deepEqual([w[11].days, w[11].current, w[10].days, w[10].deload, w[0].days], [2, true, 1, true, 0]);
  assert.equal(w[0].week, '2026-08-30');
  assert.ok(w[11].need >= 1);
});

test('keptWhileCutting: weight change beside lifts held up or down', () => {
  const body_logs = Array.from({ length: 50 }, (_, i) => ({ log_date: addDays('2026-10-01', i), weight_kg: 100 - i * 0.1 }));
  const days = ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-11-05', '2026-11-12'];
  const workouts = days.map((d, i) => wk(d, [set(1, 80 + i * 2.5), set(2, 100), set(3, 20 - i)]));
  workouts.push(wk('2026-10-29', [set(1, 50)], { is_deload: true })); // ignored
  const k = keptWhileCutting({ ...base, body_logs, workouts }, TODAY);
  assert.ok(k.weight.change < -3, String(k.weight.change));
  assert.equal(k.lifts.length, 3);
  const by = Object.fromEntries(k.lifts.map((l) => [l.name, l]));
  assert.equal(by.Bench.outcome, 'up');
  assert.equal(by.Squat.outcome, 'held');
  assert.equal(by.Curl.outcome, 'down');
  assert.equal(by.Bench.points[0].pct, 0);
  assert.equal(by.Bench.points.length, 6);
  assert.deepEqual(k.counts, { up: 1, held: 1, down: 1 });
});

test('keptWhileCutting is null for other goals or thin data', () => {
  const body_logs = [{ log_date: '2026-11-01', weight_kg: 90 }, { log_date: '2026-11-10', weight_kg: 89 }];
  const workouts = ['2026-10-30', '2026-11-03', '2026-11-08', '2026-11-12'].map((d) => wk(d, [set(1, 80)]));
  assert.ok(keptWhileCutting({ ...base, body_logs, workouts }, TODAY));
  assert.equal(keptWhileCutting({ ...base, body_logs, workouts, goals: [{ direction: 'gain' }] }, TODAY), null);
  assert.equal(keptWhileCutting({ ...base, body_logs, workouts: workouts.slice(1) }, TODAY), null);
  assert.equal(keptWhileCutting({ ...base, body_logs: body_logs.slice(1), workouts }, TODAY), null);
});
