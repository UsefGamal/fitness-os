// Measured maintenance (charts step 5, BI-13).
import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays } from './dates.js';
import { measuredBurn } from './measuredBurn.js';

const TODAY = '2026-11-19';
const SLOTS = ['breakfast', 'lunch', 'dinner'];
// 0.5 kg a week down, every day, with a little noise.
const logs = Array.from({ length: 28 }, (_, i) => ({ log_date: addDays(TODAY, -27 + i), weight_kg: Math.round((95 - (i * 0.5) / 7 + (i % 3 === 0 ? 0.2 : 0)) * 10) / 10 }));
const meals = (days, kcal = 600) => days.flatMap((d) => SLOTS.map((s) => ({ log_date: d, meal_slot: s, completed: true, eaten: { kcal } })));
const allDays = Array.from({ length: 28 }, (_, i) => addDays(TODAY, -i));
const base = { profile: { birth_year: 1990 }, settings: {}, goals: [{ direction: 'lose', set_on: '2026-09-01' }], body_logs: logs };

test('burn = eaten + 7700 x loss a day, as a range around the model', () => {
  const r = measuredBurn({ ...base, meal_logs: meals(allDays) }, SLOTS, TODAY, 2400);
  assert.equal(r.ready, true);
  assert.equal(r.eaten, 1800);
  // 0.5 kg a week = 550 kcal a day over 1800.
  assert.ok(r.mid >= 2250 && r.mid <= 2450, String(r.mid));
  assert.ok(r.low <= r.mid && r.mid <= r.high);
  assert.equal(r.low % 50, 0);
  assert.equal(r.diff, 2400 - r.mid);
  assert.equal(r.days, 28);
});

test('gates: too few meals, too few full days, water weeks, hidden calories', () => {
  assert.equal(measuredBurn({ ...base, meal_logs: meals(allDays.slice(0, 20)) }, SLOTS, TODAY).reason, 'meals');
  // 20 full days + 8 days with two of three meals: 89% of meals, 1 full day short.
  const part = [...meals(allDays.slice(0, 20)), ...allDays.slice(20).flatMap((d) => SLOTS.slice(0, 2).map((s) => ({ log_date: d, meal_slot: s, completed: true, eaten: { kcal: 600 } })))];
  const r = measuredBurn({ ...base, meal_logs: part }, SLOTS, TODAY);
  assert.deepEqual([r.reason, r.need], ['days', 1]);
  assert.equal(measuredBurn({ ...base, goals: [{ direction: 'lose', set_on: addDays(TODAY, -5) }], meal_logs: meals(allDays) }, SLOTS, TODAY).reason, 'water');
  assert.equal(measuredBurn({ ...base, body_logs: logs.slice(-5), meal_logs: meals(allDays) }, SLOTS, TODAY).reason, 'weigh');
  assert.equal(measuredBurn({ ...base, safety: { hide_kcal: true }, meal_logs: meals(allDays) }, SLOTS, TODAY).reason, 'hidden');
});
