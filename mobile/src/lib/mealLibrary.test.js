import assert from 'node:assert/strict';
import test from 'node:test';

import { applySwaps, byProtein, filterMeals, goalFit, ingredientSet, ingredientsOf, kcalFit, kindsFor, libraryMeal, mealsForSlot, pickCounts, recentKeys, recommend, shownOption, similarity, similarMeals, sortForGoal, suits } from './mealLibrary.js';
import { fitOption, planFit } from './portions.js';
import { shoppingList } from './shopping.js';
import { mealDayFor } from './meals.js';
import { content } from './testContent.js';

const N = content.nutrition;
const LIB = N.library;
const byKey = (k) => libraryMeal(k, N);

test('every library meal is in the exported content, with its numbers and items', () => {
  assert.ok(LIB.length >= 40);
  for (const m of LIB) {
    assert.ok(m.key && m.name && m.items.length && m.steps.length, m.key);
    assert.ok(m.kcal > 0 && m.protein > 0, m.key);
    for (const item of m.items) assert.ok(N.foods[item], `${m.key}: ${item} has numbers`);
  }
  assert.equal(byKey('nope'), null);
  assert.equal(byKey(null), null);
});

test('slots take meals by meal of day, and Ramadan changes the kinds', () => {
  assert.deepEqual(kindsFor('lunch', N), ['lunch']);
  assert.deepEqual(kindsFor('breakfast', N, true), ['suhoor']);
  assert.deepEqual(kindsFor('mystery', N), ['mystery']);
  assert.ok(mealsForSlot('snack1', N).every((m) => m.meals.includes('snack')));
  assert.ok(mealsForSlot('breakfast', N, true).every((m) => m.meals.includes('suhoor')));
  assert.equal(suits(byKey('yogurt_berries'), 'lunch', N), false);
  assert.equal(suits(byKey('cajun_chicken_rice'), 'lunch', N), true);
});

test('a swap adds the library meal to the day, and nothing else changes', () => {
  const day = mealDayFor(N.plan_start_date, N);
  assert.equal(applySwaps(day, () => null, N), day, 'no swaps: same object');
  assert.equal(applySwaps(day, () => 'option_a', N), day, 'old picks are ignored');
  assert.equal(applySwaps(day, (s) => (s === 'lunch' ? day.meals[2].options[0].key : null), N), day, 'the plan meal itself is not a swap');
  const swapped = applySwaps(day, (s) => (s === 'lunch' ? 'tuna_bean_salad' : null), N);
  const lunch = swapped.meals.find((m) => m.slot === 'lunch');
  assert.equal(lunch.options.length, 2);
  assert.equal(shownOption(lunch, 'tuna_bean_salad').key, 'tuna_bean_salad');
  assert.equal(shownOption(lunch, 'tuna_bean_salad').swapped, true);
  assert.equal(shownOption(lunch, null).key, day.meals[2].options[0].key);
  // The fit function is applied to the swapped meal only.
  const fitted = applySwaps(day, (s) => (s === 'dinner' ? 'shrimp_noodles' : null), N, (o) => ({ ...o, kcal: 1 }));
  assert.equal(fitted.meals[4].options[1].kcal, 1);
  assert.notEqual(fitted.meals[4].options[0].kcal, 1);
});

test('a swapped meal is scaled like the plan when portions are fitted', () => {
  const meal = byKey('chicken_pasta');
  assert.equal(fitOption(meal, { state: 'same' }, N), meal);
  const up = fitOption(meal, { state: 'scaled', factor: 1.25, cap: false }, N);
  assert.ok(up.kcal > meal.kcal);
  assert.ok(up.protein >= meal.protein, 'going up, protein never drops');
  assert.ok(up.ingredients.length === meal.items.length);
  const down = fitOption(meal, { state: 'scaled', factor: 0.8, cap: false }, N);
  assert.ok(down.kcal < meal.kcal);
});

test('the shopping list buys the swapped meal, not the plan one', () => {
  const start = N.plan_start_date;
  const swap = (date, slot) => (date === start && slot === 'lunch' ? 'shrimp_noodles' : null);
  const dayOf = (date) => applySwaps(mealDayFor(date, N), (slot) => swap(date, slot), N);
  const list = shoppingList(start, N, 1, swap, start, dayOf);
  const names = list.flatMap((g) => g.items.map((i) => i.name.toLowerCase()));
  assert.ok(names.some((n) => n.includes('shrimp')));
  const plain = shoppingList(start, N, 1, () => null, start, (d) => mealDayFor(d, N)).flatMap((g) => g.items.map((i) => i.name.toLowerCase()));
  assert.ok(!plain.some((n) => n.includes('shrimp')));
});

test('search matches names and ingredients; filters combine', () => {
  assert.ok(filterMeals(LIB, { query: 'salmon', nutrition: N }).every((m) => /salmon/i.test(m.name) || m.items.some((i) => i.startsWith('salmon'))));
  assert.ok(filterMeals(LIB, { query: 'chickpeas', nutrition: N }).length >= 2, 'by ingredient name');
  const quickFish = filterMeals(LIB, { tags: ['quick'], protein: 'fish' });
  assert.ok(quickFish.length >= 1 && quickFish.every((m) => m.protein_source === 'fish' && m.tags.includes('quick')));
  assert.ok(filterMeals(LIB, { slot: 'breakfast', nutrition: N }).every((m) => m.meals.includes('breakfast')));
  assert.equal(filterMeals(LIB, { query: 'zzzz', nutrition: N }).length, 0);
});

test('grouping by protein follows the given order', () => {
  const groups = byProtein(LIB, content.nutrition.library_proteins);
  assert.equal(groups[0].protein, 'chicken');
  assert.equal(groups.reduce((n, g) => n + g.meals.length, 0), LIB.length);
});

test('similar meals share ingredients, protein and tags', () => {
  const pasta = byKey('chicken_pasta');
  assert.equal(similarity(pasta, pasta), 0);
  assert.ok(similarity(byKey('cajun_chicken_rice'), byKey('tikka_kebabs_rice')) > similarity(byKey('cajun_chicken_rice'), byKey('yogurt_berries')));
  const sims = similarMeals(byKey('baked_salmon_potatoes'), N, { slot: 'dinner' });
  assert.ok(sims.length > 0 && sims.every((r) => r.meal.key !== 'baked_salmon_potatoes' && r.meal.meals.includes('dinner')));
  assert.ok(sims.every((r, i) => i === 0 || sims[i - 1].score >= r.score));
  assert.deepEqual(ingredientsOf({ items: ['egg_2pc', 'egg_1pc', 'pita_0.5pc'] }), ['egg', 'pita']);
});

test('goal fit: protein-dense for losing, energy for gaining', () => {
  const caesar = byKey('chicken_caesar');
  const pancakes = byKey('banana_pancakes');
  assert.ok(goalFit(caesar, 'lose') > goalFit(pancakes, 'lose'));
  assert.ok(goalFit(byKey('adana_kebab_bulgur'), 'gain') > goalFit(caesar, 'gain'));
  for (const g of ['lose', 'gain', 'maintain', 'recomp']) {
    for (const m of LIB) { const v = goalFit(m, g); assert.ok(v >= 0 && v <= 1, `${g} ${m.key}`); }
  }
  assert.equal(goalFit({ kcal: 0 }, 'lose'), 0);
  const lose = sortForGoal(mealsForSlot('lunch', N), 'lose');
  assert.ok(goalFit(lose[0], 'lose') >= goalFit(lose[lose.length - 1], 'lose'));
});

test('kcal fit is 1 within 10% of the slot and falls off after', () => {
  assert.equal(kcalFit({ kcal: 500 }, 520), 1);
  assert.ok(kcalFit({ kcal: 500 }, 800) < 0.5);
  assert.equal(kcalFit({ kcal: 500 }, null), 0.5);
  assert.equal(kcalFit({ kcal: 400 }, 500, 1.25), 1, 'the portion factor counts');
});

test('recommendations follow the goal, the history and the shopping list', () => {
  const lose = recommend('lunch', N, { goal: 'lose', limit: 5 });
  const gain = recommend('lunch', N, { goal: 'gain', limit: 5 });
  assert.notDeepEqual(lose.map((r) => r.meal.key), gain.map((r) => r.meal.key), 'goals change the picks');
  assert.ok(lose.every((r) => r.meal.meals.includes('lunch')));
  assert.ok(lose.some((r) => r.reasons.some((x) => x.kind === 'goal')));
  // A favourite comes first and is marked as such.
  const logs = [1, 2, 3].map((i) => ({ log_date: `2026-10-0${i}`, meal_slot: 'lunch', option_key: 'tuna_bean_salad', completed: true }));
  const counts = pickCounts(logs, N);
  assert.equal(counts.get('tuna_bean_salad'), 6);
  const fav = recommend('lunch', N, { counts, goal: 'maintain' });
  assert.equal(fav[0].meal.key, 'tuna_bean_salad');
  assert.ok(fav[0].reasons.some((x) => x.kind === 'often'));
  // Recent meals and the current one are left out.
  const recent = recentKeys(logs, '2026-10-02');
  assert.deepEqual([...recent], ['tuna_bean_salad']);
  assert.ok(!recommend('lunch', N, { counts, recent }).some((r) => r.meal.key === 'tuna_bean_salad'));
  assert.ok(!recommend('lunch', N, { exclude: 'chicken_pasta' }).some((r) => r.meal.key === 'chicken_pasta'));
  // Ingredients already on the list lift a meal and say so.
  const week = ingredientSet([byKey('shrimp_noodles')]);
  const withList = recommend('dinner', N, { weekIngredients: week, limit: 20 });
  const shrimpish = withList.find((r) => r.reasons.some((x) => x.kind === 'list'));
  assert.ok(shrimpish);
  assert.equal(pickCounts([{ option_key: 'option_a' }, null], N).size, 0);
});

test('the plan day still fits the person after the library change', () => {
  const fit = planFit({ profile: null, goals: [], body_logs: [], settings: {} }, N, '2026-11-16');
  assert.equal(fit.state, 'same');
});
