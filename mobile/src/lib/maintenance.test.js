import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canStartMaintenance, CLIMB_KG, hideGoalReached, reversePlan, reverseStatus, showGoalReached, startMaintenance } from './maintenance.js';

const logsFrom = (start, kgs) => kgs.map((kg, i) => {
  const d = new Date(`${start}T12:00:00`);
  d.setDate(d.getDate() + i);
  return { log_date: d.toISOString().slice(0, 10), weight_kg: kg };
});

test('the plan: 100-150 kcal steps over at most 6 weeks', () => {
  assert.deepEqual(reversePlan(1940, 2940), { step: 150, weeks: 6, gap: 1000 }); // a big gap: 6 x 150, then maintenance
  assert.deepEqual(reversePlan(2440, 2940), { step: 125, weeks: 4, gap: 500 });
  assert.deepEqual(reversePlan(2740, 2940), { step: 100, weeks: 2, gap: 200 });
  assert.deepEqual(reversePlan(2940, 2940), { step: 0, weeks: 0, gap: 0 });
  assert.deepEqual(reversePlan(3000, 2940), { step: 0, weeks: 0, gap: 0 });
});

test('one step per finished week while the weight holds', () => {
  const rev = { from_kcal: 2440, started_on: '2027-03-01', step: 125, weeks: 4 };
  const flat = logsFrom('2027-02-20', Array(60).fill(80));
  assert.equal(reverseStatus(rev, flat, 2940, '2027-03-01').kcal, 2440);
  assert.equal(reverseStatus(rev, flat, 2940, '2027-03-07').kcal, 2440);
  const w2 = reverseStatus(rev, flat, 2940, '2027-03-08');
  assert.equal(w2.kcal, 2565);
  assert.equal(w2.week, 2);
  assert.equal(w2.next_on, '2027-03-15');
  assert.equal(reverseStatus(rev, flat, 2940, '2027-03-22').kcal, 2815);
  const done = reverseStatus(rev, flat, 2940, '2027-03-29');
  assert.equal(done.done, true);
  assert.equal(done.kcal, 2940);
  assert.equal(done.next_on, null);
});

test('a week the trend climbs holds its step', () => {
  const rev = { from_kcal: 2440, started_on: '2027-03-01', step: 125, weeks: 4 };
  // Flat, then a fast climb in the first week.
  const kgs = [...Array(9).fill(80), ...Array.from({ length: 7 }, (_, i) => 80 + (i + 1) * 0.8), ...Array(30).fill(85.6)];
  const logs = logsFrom('2027-02-20', kgs);
  const s = reverseStatus(rev, logs, 2940, '2027-03-08');
  assert.equal(s.held, 1);
  assert.equal(s.heldLast, true);
  assert.equal(s.kcal, 2440);
  assert.ok(CLIMB_KG > 0);
});

test('no weigh-ins: the small steps still go on', () => {
  const rev = { from_kcal: 2440, started_on: '2027-03-01' };
  assert.equal(reverseStatus(rev, [], 2940, '2027-03-15').kcal, 2690);
});

test('reached a cut goal: the card, Not now, and starting maintenance', () => {
  const data = { settings: {}, goals: [{ id: 'g1', direction: 'lose', ended_on: null, target_low_kg: 76, target_high_kg: 79 }] };
  const reached = { status: 'reached' };
  assert.equal(canStartMaintenance(data, reached), true);
  assert.equal(canStartMaintenance(data, { status: 'steady' }), false);
  assert.equal(showGoalReached(data, reached), true);
  assert.equal(showGoalReached(hideGoalReached(data), reached), false);
  assert.equal(showGoalReached({ ...data, safety: { hide_weight: true } }, reached), false);
  const gain = { ...data, goals: [{ id: 'g1', direction: 'gain', ended_on: null }] };
  assert.equal(canStartMaintenance(gain, reached), false);

  const d = startMaintenance(data, '2027-03-01', { fromKcal: 1939.4, tdeeKcal: 2940, weightKg: 77.84 });
  assert.equal(d.goals[0].ended_on, '2027-03-01');
  const g = d.goals[1];
  assert.equal(g.direction, 'maintain');
  assert.equal(g.start_weight_kg, 77.8);
  assert.deepEqual([g.target_low_kg, g.target_high_kg], [76.8, 78.8]);
  assert.deepEqual(g.reverse, { from_kcal: 1939, started_on: '2027-03-01', step: 150, weeks: 6 });
  assert.equal(g.ended_on, null);
  assert.equal(canStartMaintenance(d, reached), false); // now a maintain goal

  const noGap = startMaintenance(data, '2027-03-01', { fromKcal: 2940, tdeeKcal: 2940, weightKg: null });
  assert.equal(noGap.goals[1].reverse, undefined);
  assert.equal(noGap.goals[1].target_low_kg, null);
  assert.equal(hideGoalReached({ goals: [] }).settings, undefined);
});
