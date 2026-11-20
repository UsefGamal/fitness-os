import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays } from './dates.js';
import { dateTicks, weeklyAverages, weightFrame } from './bodyStats.js';

const TODAY = '2026-11-19'; // a Thursday
const logs = Array.from({ length: 80 }, (_, i) => ({ log_date: addDays('2026-09-01', i), weight_kg: Math.round((103 - i * 0.1) * 10) / 10 }));
const SUN = { profile: { week_start: 'sun' } };

test('weightFrame fits the scale to the data, not the goal', () => {
  const f = weightFrame(logs, TODAY, 'm3', { low: 75, high: 80 });
  assert.equal(f.points.length, 80);
  assert.ok(f.lo > 90 && f.hi < 104.5, `${f.lo}-${f.hi}`);
  assert.equal(f.goal, 'below');
  assert.ok(f.ticks.length >= 2 && f.ticks.every((v) => v >= f.lo && v <= f.hi));
});

test('weightFrame ranges cut by date, and need 2 points', () => {
  assert.equal(weightFrame(logs, TODAY, 'm1').points.length, 28);
  assert.equal(weightFrame(logs, TODAY, 'all').points.length, 80);
  assert.deepEqual(weightFrame(logs.slice(0, 1), TODAY, 'all'), { points: weightFrame(logs.slice(0, 1), TODAY, 'all').points, lo: null, hi: null, ticks: [], goal: null });
  const flat = weightFrame([{ log_date: TODAY, weight_kg: 80 }, { log_date: addDays(TODAY, -1), weight_kg: 80 }], TODAY, 'm1', { low: 78, high: 82 });
  assert.ok(flat.hi - flat.lo >= 2);
  assert.equal(flat.goal, 'in');
});

test('weeklyAverages: newest first, with counts, changes and thin weeks', () => {
  const sparse = [
    { log_date: '2026-11-17', weight_kg: 95 }, { log_date: '2026-11-18', weight_kg: 94 }, // this week, 2
    { log_date: '2026-11-09', weight_kg: 96 }, { log_date: '2026-11-10', weight_kg: 96 }, { log_date: '2026-11-12', weight_kg: 95 },
    { log_date: '2026-10-27', weight_kg: 97 }, // a gap week before it
  ];
  const w = weeklyAverages(sparse, TODAY, SUN, 6);
  assert.deepEqual(w.map((x) => [x.week, x.avg, x.n, x.change, x.thin, x.current]), [
    ['2026-11-15', 94.5, 2, -1.2, true, true],
    ['2026-11-08', 95.7, 3, null, false, false],
    ['2026-10-25', 97, 1, null, true, false],
  ]);
});

test('dateTicks: weekly for a month, month starts for longer', () => {
  const w = dateTicks('2026-10-23', TODAY);
  assert.equal(w.length, 4);
  assert.equal(w[w.length - 1].date, TODAY);
  assert.ok(w.every((x) => x.kind === 'week'));
  assert.deepEqual(dateTicks('2026-08-21', TODAY).map((x) => x.date), ['2026-09-01', '2026-10-01', '2026-11-01']);
  assert.deepEqual(dateTicks('2026-12-20', '2027-02-10').map((x) => x.date), ['2027-01-01', '2027-02-01']);
  assert.deepEqual(dateTicks(TODAY, '2026-11-01'), []);
});
