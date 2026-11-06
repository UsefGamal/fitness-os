// The simple Meals page (E3-S9).
import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import { mealsView, proteinPerMeal, servingsFor, setMealsView } from './mealsView.js';
import { content } from './testContent.js';

test("the build decides the first view; the person's choice wins after", () => {
  const d = emptyData(content);
  assert.equal(mealsView(d, { meals_default: 'targets' }), 'targets');
  assert.equal(mealsView(d, { meals_default: 'plan' }), 'plan');
  assert.equal(mealsView(d, {}), 'plan');
  assert.equal(mealsView(d, content.nutrition), 'plan', "Yusuf's build keeps the full plan");
  const chose = setMealsView(d, 'plan');
  assert.equal(mealsView(chose, { meals_default: 'targets' }), 'plan');
  assert.equal(setMealsView(d, 'nope'), d);
  assert.equal(chose.settings.modules.meals, true, 'other settings stay');
});

test('protein per meal and servings', () => {
  assert.equal(proteinPerMeal(154, 4), 40);
  assert.equal(proteinPerMeal(null), null);
  assert.equal(servingsFor({ protein_g: 30 }, 40), 1.5);
  assert.equal(servingsFor({ protein_g: 45 }, 10), 0.5);
  assert.equal(servingsFor({ protein_g: 0 }, 40), null);
});

test('the simple view has general foods and a plate guide', () => {
  const s = content.nutrition.simple;
  assert.ok(s.protein_foods.length >= 8);
  assert.ok(s.protein_foods.every((f) => f.name && f.serving && f.protein_g > 0));
  assert.equal(s.plate_guide.length, 4);
});
