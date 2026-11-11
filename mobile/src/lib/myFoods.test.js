import assert from 'node:assert/strict';
import test from 'node:test';

import { mealLog } from './data.js';
import { dayTotals } from './meals.js';
import { cleanFood, clearCustomMeal, customMeals, forgetFood, logCustomMeal, MAX_MY_FOODS, myFoods, rememberFood } from './myFoods.js';

const base = () => ({ meal_logs: [] });

test('cleanFood rounds, trims and refuses nonsense', () => {
  assert.deepEqual(cleanFood({ name: '  Koshari   plate ', kcal: '650.4', protein: 22.6 }), { name: 'Koshari plate', kcal: 650, protein: 23 });
  assert.deepEqual(cleanFood({ kcal: 300, protein: 10 }), { name: '', kcal: 300, protein: 10 });
  assert.equal(cleanFood({ kcal: -1, protein: 0 }), null);
  assert.equal(cleanFood({ kcal: 5000, protein: 0 }), null);
  assert.equal(cleanFood({ kcal: 100, protein: 400 }), null);
  assert.equal(cleanFood({ kcal: 'x', protein: 1 }), null);
  assert.equal(cleanFood(null), null);
  assert.equal(cleanFood({ name: 'x'.repeat(80), kcal: 1, protein: 0 }).name.length, 40);
});

test('cleanFood refuses more protein than the calories can hold', () => {
  assert.equal(cleanFood({ kcal: 100, protein: 60 }), null);
  assert.ok(cleanFood({ kcal: 120, protein: 30 }));
  assert.ok(cleanFood({ kcal: 110, protein: 30 }), 'label rounding is allowed');
});

test('a custom meal counts as eaten and a named one is remembered', () => {
  const d = logCustomMeal(base(), '2026-11-11', 'lunch', { name: 'Shawarma', kcal: 700, protein: 35 });
  const log = mealLog(d, '2026-11-11', 'lunch');
  assert.equal(log.completed, true);
  assert.deepEqual(log.custom, { name: 'Shawarma', kcal: 700, protein: 35 });
  assert.deepEqual(myFoods(d), [{ name: 'Shawarma', kcal: 700, protein: 35 }]);
  assert.deepEqual(customMeals(d, '2026-11-11'), { lunch: log.custom });
  assert.deepEqual(customMeals(d, '2026-11-12'), {});
});

test('an unnamed or invalid food is not remembered', () => {
  const d = logCustomMeal(base(), '2026-11-11', 'lunch', { kcal: 500, protein: 20 });
  assert.equal(mealLog(d, '2026-11-11', 'lunch').custom.kcal, 500);
  assert.deepEqual(myFoods(d), []);
  const same = base();
  assert.equal(logCustomMeal(same, '2026-11-11', 'lunch', { kcal: -5, protein: 0 }), same);
  assert.equal(rememberFood(same, { name: 'x', kcal: 'bad', protein: 0 }), same);
});

test('remembering the same name replaces it and moves it first, with a cap', () => {
  let d = rememberFood(base(), { name: 'Foul', kcal: 300, protein: 15 });
  d = rememberFood(d, { name: 'Taameya', kcal: 350, protein: 12 });
  d = rememberFood(d, { name: 'foul', kcal: 320, protein: 16 });
  assert.deepEqual(myFoods(d).map((f) => [f.name, f.kcal]), [['foul', 320], ['Taameya', 350]]);
  for (let i = 0; i < MAX_MY_FOODS + 5; i += 1) d = rememberFood(d, { name: `f${i}`, kcal: 100, protein: 5 });
  assert.equal(myFoods(d).length, MAX_MY_FOODS);
  assert.deepEqual(myFoods(forgetFood(d, 'F34')).length, MAX_MY_FOODS - 1);
  assert.deepEqual(myFoods({ my_foods: 'broken' }), []);
});

test('clearing goes back to the plan meal, not eaten, and keeps the pick', () => {
  let d = { meal_logs: [{ id: 1, log_date: '2026-11-11', meal_slot: 'lunch', completed: false, option_key: 'option_b', drink_key: null }] };
  d = logCustomMeal(d, '2026-11-11', 'lunch', { name: 'Pizza', kcal: 900, protein: 30 });
  d = clearCustomMeal(d, '2026-11-11', 'lunch');
  const log = mealLog(d, '2026-11-11', 'lunch');
  assert.equal(log.custom, null);
  assert.equal(log.completed, false);
  assert.equal(log.option_key, 'option_b');
  assert.deepEqual(customMeals(d, '2026-11-11'), {});
});

test('dayTotals uses what was really eaten for that slot', () => {
  const day = { meals: [
    { slot: 'breakfast', options: [{ key: 'option_a', kcal: 400, protein: 30, carbs: 40, fat: 10, fiber: 5 }] },
    { slot: 'lunch', options: [{ key: 'option_a', kcal: 600, protein: 45, carbs: 60, fat: 15, fiber: 8 }] },
  ] };
  const custom = { lunch: { name: 'Pizza', kcal: 900, protein: 30 } };
  assert.deepEqual(dayTotals(day, {}, null, custom), { kcal: 1300, protein: 60, carbs: 40, fat: 10, fiber: 5 });
  assert.deepEqual(dayTotals(day, {}, new Set(['lunch']), custom), { kcal: 900, protein: 30, carbs: 0, fat: 0, fiber: 0 });
  assert.deepEqual(dayTotals(day), { kcal: 1000, protein: 75, carbs: 100, fat: 25, fiber: 13 });
});
