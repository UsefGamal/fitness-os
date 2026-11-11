import assert from 'node:assert/strict';
import test from 'node:test';

import { formatShoppingQty, parseShoppingUnit, picksFrom, shoppingList } from './shopping.js';
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

test('the first plan week merges portions (matches the Python list)', () => {
  const groups = shoppingList(N.plan_start_date, N);
  const items = Object.fromEntries(groups.flatMap((g) => g.items).map((i) => [i.name, i.qty]));
  assert.equal(items['Grilled chicken breast'], '1.5 kg');
  assert.equal(items['Boiled egg'], '×13');
  assert.equal(items['Wholewheat pita'], '×5');
  assert.equal(items['White rice'], '450 g');
  assert.equal(groups.flatMap((g) => g.items).length, 43);
  // P14-19: sentence case, never a title-cased key.
  for (const i of groups.flatMap((g) => g.items)) assert.doesNotMatch(i.name, /\b[a-z]+_|(?:\s[A-Z][a-z]+){2}/, i.name);
  assert.deepEqual(groups.map((g) => g.name), N.category_order.filter((c) => groups.some((g) => g.name === c)));
});

test('the list buys only the picked option of each meal, A by default (UX-18)', () => {
  const count = (groups) => groups.reduce((n, g) => n + g.items.length, 0);
  const both = shoppingList(N.plan_start_date, N);
  const onlyA = shoppingList(N.plan_start_date, N, 7, () => null);
  assert.ok(count(onlyA) < count(both));
  // One day, every meal switched to its second option: a different list from all-A.
  const day = N.plan_start_date;
  const logs = N.meal_slots.map((slot) => ({ log_date: day, meal_slot: slot, option_key: 'option_b' }));
  const pick = picksFrom(logs);
  assert.equal(pick(day, N.meal_slots[0]), 'option_b');
  assert.equal(pick('1999-01-01', N.meal_slots[0]), null);
  const a1 = shoppingList(day, N, 1, () => null);
  const b1 = shoppingList(day, N, 1, pick);
  assert.notDeepEqual(a1, b1);
  // A pick the meal doesn't have falls back to the first option.
  assert.deepEqual(shoppingList(day, N, 1, () => 'option_zzz'), a1);
});
