import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import { bmr, macroSplit, macroTargets, targetKcal, tdee } from './macros.js';
import { content } from './testContent.js';

const N = content.nutrition;

// Same cases as tests/test_tdee.py.
test('Mifflin-St Jeor BMR', () => {
  assert.equal(bmr(80, 180, 30, 'male'), 1780);
  assert.equal(bmr(80, 180, 30, 'female'), 1614);
});

test('TDEE multiplier, falling back to moderate', () => {
  assert.equal(tdee(1780, 'sedentary'), 1780 * 1.2);
  assert.equal(tdee(1780, 'very_active'), 1780 * 1.9);
  assert.equal(tdee(1780, 'nope'), 1780 * 1.55);
});

test('deficit from the target rate, capped and floored', () => {
  assert.equal(targetKcal(2500, null), 2500);
  assert.equal(targetKcal(2500, 0), 2500);
  assert.equal(targetKcal(2500, -0.5), 2500);
  assert.equal(targetKcal(2500, 0.5), 2500 - 550);
  assert.equal(targetKcal(3000, 5), 2000);
  assert.ok(targetKcal(1300, 2) >= 1200);
});

test('macro split', () => {
  const m = macroSplit(2000, 90);
  assert.equal(m.kcal, 2000);
  assert.equal(m.protein, 180);
  assert.equal(m.fat, 72);
  assert.ok(Math.abs(m.protein * 4 + m.carbs * 4 + m.fat * 9 - 2000) <= 4);
});

// Same cases as tests/test_macro_targets.py.
test('falls back to the plan band with no weight, or a silly age', () => {
  const d = emptyData(content);
  assert.equal(macroTargets(d, N, '2026-11-04').protein, 185);
  d.body_logs = [{ id: 1, log_date: '2026-11-04', weight_kg: 90 }];
  d.profile = { date_of_birth: '1900-01-01' };
  assert.equal(macroTargets(d, N, '2026-11-04').protein, 185);
});

test('works out real targets from the profile and the latest weigh-in', () => {
  const d = emptyData(content);
  d.profile = { height_cm: 180, date_of_birth: '1994-01-01', gender: 'male', activity_level: 'moderate', start_weight_kg: 90, goal_weight_low_kg: 80, goal_weight_high_kg: 82, goal_date: '2027-11-04' };
  d.body_logs = [{ id: 1, log_date: '2026-11-04', weight_kg: 90 }];
  const t = macroTargets(d, N, '2026-11-04');
  assert.equal(t.source, 'profile');
  assert.equal(t.protein, 180);
  assert.equal(t.fat, 72);
  assert.equal(t.kcal, 2730); // what content/tdee.py gives for the same inputs
  assert.equal(t.carbs, 340);
});
