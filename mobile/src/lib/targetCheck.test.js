import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays } from './dates.js';
import { adjustTotal, clearAdjustments, keepTarget, lowerTarget, mealsShare, stepFor, targetCheckDue, trendFlat } from './targetCheck.js';

const SLOTS = ['breakfast', 'lunch', 'dinner'];
const TODAY = '2027-01-31';
const days = (n, fn) => Array.from({ length: n }, (_, i) => fn(addDays(TODAY, -i), i));
const flatLogs = (kg = 85) => days(28, (d) => ({ log_date: d, weight_kg: kg })).reverse();
const allMeals = () => days(21, (d) => SLOTS.map((s) => ({ log_date: d, meal_slot: s, completed: true }))).flat();
const base = (extra = {}) => ({
  profile: { date_of_birth: '1990-01-01' },
  safety: { gates: {} },
  diet: {},
  settings: {},
  goals: [{ id: 'g1', set_on: '2026-11-01', direction: 'lose', ended_on: null }],
  body_logs: flatLogs(),
  meal_logs: allMeals(),
  ...extra,
});
const targets = { source: 'profile', mode: 'lose', kcal: 2000, tdee: 2900 };
const due = (d, t = targets) => targetCheckDue(d, { targets: t, slots: SLOTS, minKcal: 1500, today: TODAY });

test('three flat weeks with the meals ticked: offer 150 kcal less', () => {
  assert.deepEqual(due(base()), { step: 150 });
  assert.equal(stepFor(2400), 100);
  assert.deepEqual(due(base(), { ...targets, tdee: 2300 }), { step: 100 });
});

test('a trend still moving, too few weigh-ins or too few meals: no offer', () => {
  const falling = days(28, (d, i) => ({ log_date: d, weight_kg: 85 + i * 0.1 })).reverse();
  assert.equal(trendFlat(falling, TODAY), false);
  assert.equal(due(base({ body_logs: falling })), null);
  assert.equal(due(base({ body_logs: flatLogs().slice(-5) })), null);
  const half = allMeals().filter((_, i) => i % 2);
  assert.ok(mealsShare(base({ meal_logs: half }), SLOTS, TODAY) < 0.8);
  assert.equal(due(base({ meal_logs: half })), null);
});

test('never with a limit on, calories hidden, under 18, in Ramadan, or not on a cut', () => {
  assert.equal(due(base({ safety: { gates: { no_deficit: true } } })), null);
  assert.equal(due(base({ safety: { gates: {}, hide_kcal: true } })), null);
  assert.equal(due(base({ profile: { date_of_birth: '2012-01-01' } })), null);
  assert.equal(due(base({ diet: { ramadan: { from: '2027-01-20', to: '2027-02-18' } } })), null);
  assert.equal(due(base({ goals: [{ id: 'g1', set_on: '2026-11-01', direction: 'maintain', ended_on: null }] }), { ...targets, mode: 'maintain' }), null);
  assert.equal(due(base(), { ...targets, source: 'plan' }), null);
  assert.equal(due(base(), { ...targets, kcal: 1600 }), null); // would go under the floor
});

test('at most once every three weeks: after a new goal, an adjustment or Keep as is', () => {
  assert.equal(due(base({ goals: [{ id: 'g1', set_on: '2027-01-20', direction: 'lose', ended_on: null }] })), null);
  const lowered = lowerTarget(base(), 150, '2027-01-25');
  assert.equal(adjustTotal(lowered), -150);
  assert.equal(due(lowered), null);
  assert.equal(due(keepTarget(base(), '2027-01-25')), null);
  assert.deepEqual(due(keepTarget(base(), '2027-01-10')), { step: 150 });
  assert.equal(adjustTotal(lowerTarget(lowered, 100, '2027-02-20')), -250);
});

test('bad adjustment rows are ignored, and no goal means nothing to change', () => {
  const d = base({ goals: [{ id: 'g1', direction: 'lose', ended_on: null, kcal_adjust: [{ on: '2027-01-01', kcal: -100 }, { kcal: 'x' }, null] }] });
  assert.equal(adjustTotal(d), -100);
  const none = base({ goals: [] });
  assert.equal(lowerTarget(none, 150, TODAY), none);
  assert.equal(keepTarget(none, TODAY), none);
  assert.equal(due(none), null);
});

test('undo clears the adjustments', () => {
  const d = lowerTarget(base(), 150, '2027-01-25');
  assert.equal(adjustTotal(clearAdjustments(d)), 0);
  assert.equal(clearAdjustments(d).goals[0].kcal_adjust, undefined);
});
