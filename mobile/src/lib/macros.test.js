import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import { bmr, energyTarget, goalIssues, macroSplit, macroTargets, maxDeficit, minGoalWeight, safeGoalDate, targetKcal, tdee } from './macros.js';
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

test('deficit from the target rate, capped at 1000 kcal and 1% BW a week', () => {
  assert.equal(targetKcal(2500, null), 2500);
  assert.equal(targetKcal(2500, 0), 2500);
  assert.equal(targetKcal(2500, -0.5), 2500);
  assert.equal(targetKcal(2500, 0.5), 2500 - 550);
  assert.equal(targetKcal(3000, 5), 3000 - 1000, 'no share-of-TDEE cap');
  assert.equal(targetKcal(4400, 5), 4400 - 1000, '1000 kcal');
  assert.equal(targetKcal(4400, 5, 80), 4400 - 880, '1% of 80 kg a week');
  assert.equal(maxDeficit(2000, 100), 1000);
  assert.equal(maxDeficit(2000, 60), 660, '1% of 60 kg a week');
});

test('floors: 1500 kcal for men, 1200 for women', () => {
  assert.deepEqual(energyTarget({ tdee: 1700, rate: 1, weight: 70, gender: 'male' }), { kcal: 1500, deficit: 200, reasons: ['capped', 'floor'] });
  assert.equal(energyTarget({ tdee: 1500, rate: 1, weight: 60, gender: 'female' }).kcal, 1200);
});

test('goal direction: maintain is TDEE, gain is +300', () => {
  assert.deepEqual(energyTarget({ tdee: 2500, rate: 0.5, weight: 70, mode: 'maintain' }), { kcal: 2500, deficit: 0, reasons: [] });
  assert.equal(energyTarget({ tdee: 2500, rate: null, weight: 70, mode: 'gain' }).kcal, 2800);
  assert.deepEqual(energyTarget({ tdee: 2500, rate: null, weight: 70, gender: 'male' }).reasons, ['no_pace']);
});

test('macro split: protein 2.0 / 1.8 / 1.6 g per kg of goal weight', () => {
  const m = macroSplit(2000, 77.5);
  assert.equal(m.kcal, 2000);
  assert.equal(m.protein, 155);
  assert.equal(m.fat, 62);
  assert.ok(Math.abs(m.protein * 4 + m.carbs * 4 + m.fat * 9 - 2000) <= 4);
  assert.equal(macroSplit(2500, 70, 'maintain').protein, 126);
  assert.equal(macroSplit(2800, 80, 'gain').protein, 128);
});

test('goal weights under BMI 18.5 are refused', () => {
  assert.deepEqual(goalIssues({ height_cm: 173, goal_weight_low_kg: 55 }), ['bmi']);
  assert.deepEqual(goalIssues({ height_cm: 173, goal_weight_low_kg: 56 }), []);
  assert.equal(minGoalWeight(173), 55.5);
});

test('the safe goal date follows the capped pace', () => {
  // 10 kg to go at 1000 kcal a day (0.909 kg a week) is 77 days.
  assert.equal(safeGoalDate({ mode: 'lose', weight: 100, goal_weight: 90, tdee: 4400, today: '2026-11-08' }), '2027-01-24');
  assert.equal(safeGoalDate({ mode: 'lose', weight: 80, goal_weight: 90, tdee: 3000, today: '2026-11-08' }), null);
  assert.equal(safeGoalDate({ mode: 'gain', weight: 60, goal_weight: 65, tdee: 3000, today: '2026-11-08' }), null);
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
  assert.equal(t.mode, 'lose');
  assert.equal(t.protein, 162); // 2.0 g x 81 kg goal midpoint
  assert.equal(t.fat, 65);
  assert.equal(t.kcal, 2730); // under every cap: what content/tdee.py gives too
  assert.equal(t.carbs, 374);
  assert.deepEqual(t.reasons, []);
});

// ── Recomp (E3-S13) and rule A ─────────────────────────────────────────
test('recomp: a 10-15% deficit, 12.5% without a pace', () => {
  assert.deepEqual(energyTarget({ tdee: 2400, rate: null, weight: 70, mode: 'recomp', gender: 'male' }), { kcal: 2100, deficit: 300, reasons: [] });
  // A fast pace is held to 15%, a slow one lifted to 10%.
  assert.equal(energyTarget({ tdee: 2400, rate: 1, weight: 70, mode: 'recomp', gender: 'male' }).kcal, 2040);
  assert.equal(energyTarget({ tdee: 2400, rate: 0.05, weight: 70, mode: 'recomp', gender: 'male' }).kcal, 2160);
  // The floor still holds.
  assert.deepEqual(energyTarget({ tdee: 1300, rate: null, weight: 50, mode: 'recomp', gender: 'female' }), { kcal: 1200, deficit: 100, reasons: ['floor'] });
  assert.equal(macroSplit(2100, 70, 'recomp').protein, 154, '2.2 g per kg of goal weight');
});

test('rule A: the friends build caps a cut at 25% of TDEE', () => {
  const fast = { tdee: 1800, rate: 1, weight: 60, mode: 'lose', gender: 'female' };
  assert.equal(energyTarget(fast).kcal, 1200, "Yusuf's build: no share cap, so 1% BW a week and the floor decide");
  assert.deepEqual(energyTarget({ ...fast, share: 0.25 }), { kcal: 1350, deficit: 450, reasons: ['capped'] });
});
