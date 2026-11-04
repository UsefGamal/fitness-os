import assert from 'node:assert/strict';
import test from 'node:test';

import { formatShoppingQty, parseShoppingUnit, shoppingList } from './shopping.js';
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
  assert.equal(items['Grilled Chicken Breast'], '1.5 kg');
  assert.equal(items['Boiled Egg'], '×13');
  assert.equal(items['Whole Wheat Pita'], '×5');
  assert.equal(items['White Rice'], '450 g');
  assert.equal(groups.flatMap((g) => g.items).length, 43);
  assert.deepEqual(groups.map((g) => g.name), N.category_order.filter((c) => groups.some((g) => g.name === c)));
});
