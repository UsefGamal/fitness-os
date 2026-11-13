import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { emptyData, mealLog } from './data.js';
import { parseDataFile, toDataFile } from './dataFile.js';
import { backfillEaten, dayTotals, eatenMeals, eatenOf, mealDayFor, mealDayNumber, mealStart, pickOption, slotLabel, tickMeal } from './meals.js';
import { migrate } from './migrate.js';
import { clearCustomMeal, logCustomMeal } from './myFoods.js';
import { finishSetup } from './setup.js';
import { widgetDays } from './widget.js';
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

// DA-1: past meals never change.
const DAY = '2026-11-04';
const planDay = () => mealDayFor(DAY, N);
const breakfast = () => planDay().meals.find((m) => m.slot === 'breakfast');

test('ticking a meal copies its numbers; unticking clears them', () => {
  const [a, b] = breakfast().options;
  let d = tickMeal(emptyData(content), DAY, 'breakfast', a, true);
  const row = mealLog(d, DAY, 'breakfast');
  assert.equal(row.completed, true);
  assert.equal(row.option_key, a.key);
  assert.deepEqual(row.eaten, { kcal: a.kcal, protein: a.protein, carbs: a.carbs, fat: a.fat, fiber: a.fiber });
  // Another pick on a ticked meal: the numbers follow it.
  d = pickOption(d, DAY, 'breakfast', b);
  assert.deepEqual(mealLog(d, DAY, 'breakfast').eaten, eatenOf(b));
  // On a meal not ticked, a pick copies nothing.
  d = pickOption(d, DAY, 'lunch', planDay().meals.find((m) => m.slot === 'lunch').options[0]);
  assert.equal(mealLog(d, DAY, 'lunch').eaten, undefined);
  d = tickMeal(d, DAY, 'breakfast', b, false);
  assert.equal(mealLog(d, DAY, 'breakfast').completed, false);
  assert.equal(mealLog(d, DAY, 'breakfast').eaten, null);
  assert.deepEqual(eatenMeals(d, DAY), {});
});

test('a ticked meal keeps its numbers when the meal plan changes later', () => {
  const a = breakfast().options[0];
  const d = tickMeal(emptyData(content), DAY, 'breakfast', a, true);
  const only = new Set(['breakfast']);
  const before = dayTotals(planDay(), {}, only, {}, eatenMeals(d, DAY));
  // The same day, after someone edits the plan's breakfast.
  const edited = { ...planDay(), meals: planDay().meals.map((m) => (m.slot === 'breakfast' ? { ...m, options: m.options.map((o) => ({ ...o, kcal: o.kcal + 300, protein: o.protein + 20 })) } : m)) };
  assert.deepEqual(dayTotals(edited, {}, only, {}, eatenMeals(d, DAY)), before);
  // Without the copy the total would have moved.
  assert.equal(dayTotals(edited, {}, only).kcal, before.kcal + 300);
  // A copy gives the same total as the content did on the day it was ticked.
  assert.deepEqual(before, dayTotals(planDay(), {}, only));
});

test('something else eaten wins over the copy, and going back clears both', () => {
  const a = breakfast().options[0];
  let d = tickMeal(emptyData(content), DAY, 'breakfast', a, true);
  d = logCustomMeal(d, DAY, 'breakfast', { name: 'Koshari', kcal: 700, protein: 20 });
  assert.equal(mealLog(d, DAY, 'breakfast').eaten, null);
  assert.deepEqual(eatenMeals(d, DAY), {});
  d = clearCustomMeal(d, DAY, 'breakfast');
  assert.equal(mealLog(d, DAY, 'breakfast').eaten, null);
});

test('old ticked meals get their numbers once; nothing else is touched', () => {
  const [a, b] = breakfast().options;
  const old = {
    ...emptyData(content),
    meal_logs: [
      { id: 1, log_date: DAY, meal_slot: 'breakfast', completed: true, option_key: b.key, drink_key: null },
      { id: 2, log_date: DAY, meal_slot: 'lunch', completed: false, option_key: null, drink_key: null },
      { id: 3, log_date: DAY, meal_slot: 'dinner', completed: true, option_key: null, drink_key: null, custom: { name: 'Pizza', kcal: 900, protein: 30 } },
      { id: 4, log_date: DAY, meal_slot: 'snack1', completed: true, option_key: 'gone_from_the_plan', drink_key: null },
      { id: 5, log_date: DAY, meal_slot: 'not_a_slot', completed: true, option_key: null, drink_key: null },
    ],
  };
  const filled = backfillEaten(old, N);
  assert.deepEqual(filled.meal_logs[0].eaten, eatenOf(b));
  assert.equal(filled.meal_logs[1], old.meal_logs[1]);
  assert.equal(filled.meal_logs[2], old.meal_logs[2]);
  // An option the plan no longer has counts as option A, as the screen showed it.
  assert.deepEqual(filled.meal_logs[3].eaten, eatenOf(planDay().meals.find((m) => m.slot === 'snack1').options[0]));
  assert.equal(filled.meal_logs[4], old.meal_logs[4]);
  assert.notEqual(a.key, b.key);
  // Again: the same object, so the store sees no change.
  assert.equal(backfillEaten(filled, N), filled);
  const fresh = emptyData(content);
  assert.equal(backfillEaten(fresh, N), fresh);
  // The day's eaten total is what it was before the backfill.
  const slots = new Set(['breakfast', 'snack1']);
  assert.deepEqual(dayTotals(planDay(), { breakfast: b.key }, slots, {}, eatenMeals(filled, DAY)), dayTotals(planDay(), { breakfast: b.key }, slots));
});

test('the meal plan counts from the person\'s own start date', () => {
  // Data from before setup existed: the content's date, so the day does not move.
  const yusuf = migrate(JSON.parse(readFileSync(new URL('./fixtures/v1-yusuf-like.json', import.meta.url), 'utf8')), content);
  assert.equal(mealStart(yusuf, N), N.plan_start_date);
  for (const iso of ['2026-11-08', '2026-11-12', '2027-01-01']) assert.equal(mealDayFor(iso, N, mealStart(yusuf, N)), mealDayFor(iso, N));
  // A friend: day 1 is the day setup was finished.
  const friend = finishSetup(emptyData(content), content, { gender: 'male', birth_year: 1995, height_cm: 178, weight_kg: 82, goal: 'maintain', where: 'gym', days: 3, experience: 'new' }, '2026-12-10');
  assert.equal(mealStart(friend, N), '2026-12-10');
  assert.equal(mealDayNumber('2026-12-10', N, mealStart(friend, N)), 1);
  assert.equal(mealDayFor('2026-12-10', N, mealStart(friend, N)), N.days[0]);
  assert.equal(mealDayFor('2026-12-24', N, mealStart(friend, N)), N.days[0]);
  // No diet block at all: the content's date.
  assert.equal(mealStart({}, N), N.plan_start_date);
});

test('the copied numbers survive a backup, and the widget counts them', () => {
  const a = breakfast().options[0];
  const d = tickMeal(emptyData(content), DAY, 'breakfast', a, true);
  const back = parseDataFile(toDataFile(d), content);
  assert.deepEqual(mealLog(back, DAY, 'breakfast').eaten, eatenOf(a));
  // The widget's protein line uses the copy, not today's content.
  const moved = { ...d, meal_logs: d.meal_logs.map((m) => ({ ...m, eaten: { ...m.eaten, protein: 77 } })) };
  assert.match(widgetDays(moved, content, DAY)[0].stats, /^Protein 77\//);
});
