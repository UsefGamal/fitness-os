import assert from 'node:assert/strict';
import test from 'node:test';

import { formatShoppingQty, parseShoppingUnit, picksFrom, shoppingList } from './shopping.js';
import { applySwaps } from './mealLibrary.js';
import { mealDayFor } from './meals.js';
import { content } from './testContent.js';

const N = content.nutrition;

// Same cases as tests/test_meals.py and content/food_items.py.
test('portion sizes parse to a base food, quantity and unit', () => {
  assert.deepEqual(parseShoppingUnit('grilled_chicken_breast_200g'), ['grilled_chicken_breast', 200, 'g']);
  assert.deepEqual(parseShoppingUnit('labneh_2tbsp'), ['labneh', 2, 'tbsp']);
  assert.deepEqual(parseShoppingUnit('whole_wheat_pita_half'), ['whole_wheat_pita', 0.5, 'unit']);
  assert.deepEqual(parseShoppingUnit('boiled_egg'), ['boiled_egg', 1, 'unit']);
});

test('quantities format like the old site', () => {
  assert.equal(formatShoppingQty(1500, 'g'), '1.5 kg');
  assert.equal(formatShoppingQty(450, 'g'), '450 g');
  assert.equal(formatShoppingQty(4, 'tbsp'), '4 tbsp');
  assert.equal(formatShoppingQty(1, 'slice'), '1 slice');
  assert.equal(formatShoppingQty(13, 'unit'), '×13');
  assert.equal(formatShoppingQty(2.5, 'unit'), '×2.5');
});

test('the first plan week merges portions into ingredients to buy', () => {
  const groups = shoppingList(N.plan_start_date, N);
  const items = Object.fromEntries(groups.flatMap((g) => g.items).map((i) => [i.key, i.qty]));
  // Expected totals straight from the plan's items: grams and pieces add up.
  const want = new Map();
  for (let i = 0; i < 7; i += 1) {
    const day = N.days[i];
    for (const meal of day.meals) {
      for (const item of meal.options[0].items) {
        const [base, qty, unit] = parseShoppingUnit(item);
        want.set(`${base}|${unit}`, (want.get(`${base}|${unit}`) || 0) + qty);
      }
    }
  }
  assert.equal(Object.keys(items).length, want.size);
  for (const [k, total] of want) assert.equal(items[k], formatShoppingQty(total, k.split('|')[1]), k);
  assert.ok(items['chicken_breast|g'], 'chicken by weight');
  assert.ok(items['egg|pc'], 'eggs by count');
  // P14-19: sentence case, never a key.
  for (const i of groups.flatMap((g) => g.items)) assert.doesNotMatch(i.name, /\b[a-z]+_/, i.name);
  assert.deepEqual(groups.map((g) => g.name), N.category_order.filter((c) => groups.some((g) => g.name === c)));
});

test('the list buys the picked meal of each slot: the plan meal, or a library swap (UX-18)', () => {
  const day = N.plan_start_date;
  const plain = shoppingList(day, N, 1, () => null);
  // A library swap only shows when the day carries it (lib/mealLibrary.js applySwaps).
  const logs = [{ log_date: day, meal_slot: 'lunch', option_key: 'shrimp_noodles' }];
  const pick = picksFrom(logs);
  assert.equal(pick(day, 'lunch'), 'shrimp_noodles');
  assert.equal(pick('1999-01-01', 'lunch'), null);
  const dayOf = (iso) => applySwaps(mealDayFor(iso, N), (slot) => pick(iso, slot), N);
  const swapped = shoppingList(day, N, 1, pick, N.plan_start_date, dayOf);
  assert.notDeepEqual(swapped, plain);
  assert.ok(swapped.flatMap((g) => g.items).some((i) => i.key === 'shrimp|g'));
  // A pick the day doesn't have falls back to the plan meal.
  assert.deepEqual(shoppingList(day, N, 1, () => 'option_zzz'), plain);
});
