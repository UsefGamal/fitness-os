import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays } from './dates.js';
import { goalProgress, linearRate, predictedDate, trendSeries } from './progress.js';

const weekly = (start, perWeek, n, from = '2026-09-01') => Array.from({ length: n }, (_, i) => ({ id: i + 1, log_date: addDays(from, i * 7), weight_kg: Math.round((start - perWeek * i) * 10) / 10 }));
const GOAL = { direction: 'lose', start_weight_kg: 103, target_low_kg: 75, target_high_kg: 80, target_date: '2027-03-15' };

// Same cases as projections.py's behaviour.
test('linear rate: kg a week, positive when losing; null when too short', () => {
  assert.equal(linearRate([{ date: '2026-09-01', y: 100 }]), null);
  assert.equal(linearRate([{ date: '2026-09-01', y: 100 }, { date: '2026-09-05', y: 99 }]), null);
  assert.equal(linearRate([{ date: '2026-09-01', y: 100 }, { date: '2026-09-15', y: 98 }]), 1);
  assert.equal(linearRate([{ date: '2026-09-01', y: 70 }, { date: '2026-09-15', y: 71 }]), -0.5);
});

test('predicted date', () => {
  assert.equal(predictedDate(90, 80, 1, '2026-11-08'), '2027-01-17');
  assert.equal(predictedDate(80, 80, 1, '2026-11-08'), '2026-11-08');
  assert.equal(predictedDate(90, 80, 0, '2026-11-08'), null);
});

test('the trend smooths a one-day spike and handles gaps and order', () => {
  const s = trendSeries([
    { log_date: '2026-09-03', weight_kg: 102 },
    { log_date: '2026-09-01', weight_kg: 100 },
    { log_date: '2026-09-02', weight_kg: 100 },
    { log_date: '2026-09-04', weight_kg: null },
  ]);
  assert.deepEqual(s.map((p) => p.date), ['2026-09-01', '2026-09-02', '2026-09-03']);
  assert.equal(s[2].trend, 100.2, 'a 2 kg spike moves the trend 0.2 kg');
  const gap = trendSeries([{ log_date: '2026-09-01', weight_kg: 100 }, { log_date: '2026-09-11', weight_kg: 98 }]);
  assert.ok(gap[1].trend < 99.0 && gap[1].trend > 98.5, 'a 10-day gap trusts the new weigh-in more');
});

test('no weigh-ins: no card; too few: asks for more, no pace', () => {
  assert.equal(goalProgress([], GOAL, '2026-11-08'), null);
  const p = goalProgress(weekly(103, 0.8, 2), GOAL, '2026-09-10');
  assert.equal(p.status, 'early');
  assert.equal(p.pace, null);
  assert.equal(p.logs_needed, 1);
  assert.equal(p.range, null);
});

test('steady loss inside the safe band gives a date range around the goal date', () => {
  const logs = weekly(103, 0.9, 10);
  const today = logs[logs.length - 1].log_date;
  const p = goalProgress(logs, GOAL, today);
  assert.equal(p.status, 'steady');
  assert.ok(p.pace > 0.6 && p.pace < 1, String(p.pace));
  assert.ok(p.pct >= 0.5 && p.pct <= 1);
  assert.ok(p.range[0] < p.range[1]);
  assert.ok(['ahead', 'on', 'after'].includes(p.vs_goal));
  assert.ok(p.done_kg > 0 && p.left_kg > 0);
  assert.ok(p.share_done > 0 && p.share_done < 1);
});

test('statuses: fast, slow, holding; never "behind"', () => {
  const at = (logs) => goalProgress(logs, GOAL, logs[logs.length - 1].log_date);
  assert.equal(at(weekly(103, 2, 6)).status, 'fast');
  assert.equal(at(weekly(103, 0.2, 6)).status, 'slow');
  const flat = at(weekly(103, 0, 6));
  assert.equal(flat.status, 'holding');
  assert.equal(flat.range, null);
  const slow = at(weekly(103, 0.2, 6));
  assert.equal(slow.vs_goal, 'after');
});

test('reached, gain and maintain goals', () => {
  const done = goalProgress(weekly(81, 0.5, 6), GOAL, '2026-10-06');
  assert.equal(done.status, 'reached');
  const gain = goalProgress(weekly(60, -0.3, 6), { direction: 'gain', start_weight_kg: 60, target_low_kg: 64, target_high_kg: 66, target_date: '2027-06-01' }, '2026-10-06');
  assert.ok(gain.pace > 0, 'gaining counts as moving towards the goal');
  assert.equal(gain.status, 'steady');
  assert.ok(gain.done_kg > 0);
  const keep = goalProgress(weekly(70, 0.05, 6), { direction: 'maintain', target_low_kg: 69, target_high_kg: 71 }, '2026-10-06');
  assert.equal(keep.status, 'steady');
  assert.equal(keep.range, null);
});
