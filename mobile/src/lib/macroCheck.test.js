import assert from 'node:assert/strict';
import test from 'node:test';

import { atwater, dayDrift, optionIssues, planIssues } from './macroCheck.js';
import { content } from './testContent.js';

test('Atwater and food sums catch numbers that disagree', () => {
  assert.equal(atwater({ protein: 30, carbs: 50, fat: 20 }), 500);
  assert.deepEqual(optionIssues({ kcal: 500, protein: 30, carbs: 50, fat: 20 }), []);
  assert.equal(optionIssues({ kcal: 800, protein: 30, carbs: 50, fat: 20 })[0].kind, 'atwater');
  const foods = { egg: [70, 6, 0.5, 5, 0] };
  assert.equal(optionIssues({ kcal: 140, protein: 12, carbs: 1, fat: 10, items: ['egg', 'egg'] }, foods).length, 0);
  assert.equal(optionIssues({ kcal: 300, protein: 25, carbs: 10, fat: 18, items: ['egg'] }, foods)[0].kind, 'foods');
});

test('a day more than 10% off on calories or protein is flagged', () => {
  const target = { kcal: 2000, protein: 180 };
  assert.deepEqual(dayDrift({ kcal: 2100, protein: 175 }, target), []);
  const d = dayDrift({ kcal: 1700, protein: 210 }, target);
  assert.deepEqual(d.map((r) => [r.key, r.over]), [['kcal', false]], 'protein over is fine');
  assert.deepEqual(dayDrift({ kcal: 2000, protein: 150 }, target).map((r) => [r.key, r.over]), [['protein', false]]);
});

test('the bundled meal plan is checked without errors', () => {
  assert.ok(Array.isArray(planIssues(content.nutrition)));
});
