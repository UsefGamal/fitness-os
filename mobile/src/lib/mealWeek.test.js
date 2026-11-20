// Meals: last 7 days (charts step 5).
import assert from 'node:assert/strict';
import test from 'node:test';

import { mealWeek } from './mealWeek.js';

const TODAY = '2026-11-19';
const SLOTS = ['breakfast', 'lunch', 'dinner'];
const row = (d, s, protein = 50) => ({ log_date: d, meal_slot: s, completed: true, eaten: { protein } });

test('logged full / part / none, and protein on logged days only', () => {
  const meal_logs = [
    ...SLOTS.map((s) => row('2026-11-19', s, 50)), // 150 g: hit
    row('2026-11-18', 'breakfast', 40), row('2026-11-18', 'lunch', 40), // part, 80 g: short
    ...SLOTS.map((s) => row('2026-11-12', s)), // 8 days ago: out
    { log_date: '2026-11-17', meal_slot: 'lunch', completed: false },
  ];
  const w = mealWeek({ meal_logs }, SLOTS, TODAY, 160);
  assert.equal(w.days.length, 7);
  assert.equal(w.days[0].date, '2026-11-13');
  assert.deepEqual(w.days.slice(-3).map((d) => d.logged), ['none', 'part', 'full']);
  assert.deepEqual(w.days.slice(-3).map((d) => d.hit), [null, false, true]);
  assert.deepEqual([w.full, w.proteinDays, w.proteinHit, w.showProtein], [1, 2, 1, true]);
});

test('protein hidden with calories hidden or the protein limit on', () => {
  assert.equal(mealWeek({ meal_logs: [], safety: { hide_kcal: true } }, SLOTS, TODAY, 160).showProtein, false);
  assert.equal(mealWeek({ meal_logs: [], safety: { gates: { protein_cap: true } } }, SLOTS, TODAY, 160).showProtein, false);
});
