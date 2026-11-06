import assert from 'node:assert/strict';
import test from 'node:test';

import { dayTotals, mealDayFor, mealDayNumber, slotLabel } from './meals.js';
import { content } from './testContent.js';

const N = content.nutrition;

test('day 1 is the plan start date and the plan cycles every 14 days', () => {
  assert.equal(mealDayNumber(N.plan_start_date, N), 1);
  assert.equal(mealDayFor(N.plan_start_date, N).day_index, 1);
  assert.equal(mealDayFor('2026-09-15', N).day_index, 1);
  assert.equal(mealDayFor('2026-09-02', N).day_index, 2);
  assert.equal(mealDayFor('2026-08-31', N).day_index, 14);
});

test('day totals follow the picked options', () => {
  const day = mealDayFor(N.plan_start_date, N);
  const a = dayTotals(day);
  assert.equal(a.kcal, Math.round(day.meals.reduce((s, m) => s + m.options[0].kcal, 0)));
  const b = dayTotals(day, { breakfast: 'option_b' });
  assert.equal(b.kcal, a.kcal - Math.round(day.meals[0].options[0].kcal) + Math.round(day.meals[0].options[1].kcal));
});

test('slot labels', () => {
  assert.equal(slotLabel('snack1'), 'Morning snack');
  assert.equal(slotLabel('dinner'), 'Dinner');
});

test('eaten totals: only the ticked meals, and 0 with none ticked (E3-S12)', () => {
  const day = mealDayFor('2026-11-08', content.nutrition);
  assert.deepEqual(dayTotals(day, {}, new Set()), { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const slot = day.meals[0].slot;
  assert.equal(dayTotals(day, {}, new Set([slot])).kcal, Math.round(day.meals[0].options[0].kcal));
  assert.ok(dayTotals(day, {}).kcal > dayTotals(day, {}, new Set([slot])).kcal);
});
