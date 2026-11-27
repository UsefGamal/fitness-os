import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import { bmr, energyTarget, goalIssues, macroSplit, macroTargets, maxDeficit, minGoalWeight, pyRound, saveProfile, safeGoalDate, targetKcal, tdee } from './macros.js';
import { content } from './testContent.js';
import { QUESTIONS, applyScreening, skipScreening } from './safety.js';

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
  // The goal has to be on the side the person is heading.
  const p = { height_cm: 173, goal_weight_low_kg: 75, goal_weight_high_kg: 80 };
  assert.deepEqual(goalIssues({ ...p, direction: 'gain' }, 95), ['gainBelow']);
  assert.deepEqual(goalIssues({ ...p, direction: 'gain' }, 70), []);
  assert.deepEqual(goalIssues({ ...p, direction: 'lose' }, 70), ['loseAbove']);
  assert.deepEqual(goalIssues({ ...p, direction: 'lose' }, 95), []);
  assert.deepEqual(goalIssues({ ...p, direction: 'maintain' }, 95), []);
  assert.deepEqual(goalIssues({ ...p, direction: 'lose' }), []);
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

// ── Maintenance after a reached goal (MAINT-1) ─────────────────────────
test('maintain with a reverse: weekly steps up to the TDEE, then plain maintenance', () => {
  const d = emptyData(content);
  d.profile = { height_cm: 180, date_of_birth: '1994-01-01', gender: 'male', activity_level: 'moderate' };
  d.body_logs = [{ id: 1, log_date: '2027-03-01', weight_kg: 80 }];
  d.goals = [{ id: 'g2', direction: 'maintain', start_weight_kg: 80, target_low_kg: 79, target_high_kg: 81, ended_on: null, reverse: { from_kcal: 2000, started_on: '2027-03-01', step: 150, weeks: 6 } }];
  const first = macroTargets(d, N, '2027-03-03');
  assert.equal(first.mode, 'maintain');
  assert.equal(first.kcal, 2000);
  assert.deepEqual(first.reasons, ['reverse']);
  assert.equal(first.reverse.week, 1);
  assert.equal(first.deficit, first.tdee - 2000);
  assert.equal(macroTargets(d, N, '2027-03-15').kcal, 2300);
  const after = macroTargets(d, N, '2027-04-12');
  assert.equal(after.reverse.done, true);
  assert.equal(after.kcal, after.tdee);
  assert.deepEqual(after.reasons, []);
  // Without a reverse, maintain is the TDEE from day one.
  delete d.goals[0].reverse;
  assert.equal(macroTargets(d, N, '2027-03-03').reverse, undefined);
});

// ── The weekly target check's adjustments (TARGET-1) ───────────────────
test('a confirmed adjustment lowers a cut, never under the floor, and not maintenance', () => {
  const d = emptyData(content);
  d.profile = { height_cm: 180, date_of_birth: '1994-01-01', gender: 'male', activity_level: 'moderate' };
  d.body_logs = [{ id: 1, log_date: '2027-01-31', weight_kg: 90 }];
  d.goals = [{ id: 'g1', direction: 'lose', start_weight_kg: 95, target_low_kg: 80, target_high_kg: 82, target_date: '2027-12-01', ended_on: null }];
  const before = macroTargets(d, N, '2027-01-31');
  d.goals[0].kcal_adjust = [{ on: '2027-01-31', kcal: -150 }];
  const after = macroTargets(d, N, '2027-01-31');
  assert.equal(after.kcal, before.kcal - 150);
  assert.equal(after.adjust, -150);
  assert.ok(after.reasons.includes('adjusted'));
  // A huge cut stops at the safe deficit (25% of TDEE here), not the floor (audit NUT-4).
  d.goals[0].kcal_adjust = [{ on: '2027-01-31', kcal: -5000 }];
  const held = macroTargets(d, N, '2027-01-31');
  assert.equal(held.kcal, pyRound(held.tdee - maxDeficit(held.tdee, held.weight, N.max_deficit_share)));
  assert.ok(held.kcal > 1500 && held.reasons.includes('capped'));
  assert.ok(held.deficit <= held.tdee * 0.25 + 1);
  d.goals[0].direction = 'maintain';
  assert.equal(macroTargets(d, N, '2027-01-31').adjust, undefined);
});

// Audit 26 Nov 2026: rules that meet each other.
const auditBase = () => {
  const d = emptyData(content);
  d.profile = { height_cm: 175, date_of_birth: '1990-01-01', gender: 'male', activity_level: 'moderate' };
  d.body_logs = [{ id: 1, log_date: '2027-01-31', weight_kg: 95 }];
  d.goals = [{ id: 'g1', set_on: '2026-12-01', direction: 'lose', start_weight_kg: 100, target_low_kg: 80, target_high_kg: 82, target_date: '2027-12-01', ended_on: null }];
  return d;
};

test('NUT-1: the step-up back to maintenance stops while a gate asks for no deficit', () => {
  const d = auditBase();
  d.goals = [{ id: 'g2', set_on: '2027-01-20', direction: 'maintain', start_weight_kg: 95, target_low_kg: 94, target_high_kg: 96, target_date: null, ended_on: null, reverse: { from_kcal: 2000, started_on: '2027-01-20', step: 100, weeks: 6 } }];
  const stepping = macroTargets(d, N, '2027-01-31');
  assert.ok(stepping.reverse && stepping.kcal < stepping.tdee);
  const gated = skipScreening(d, '2027-01-31');
  const t = macroTargets(gated, N, '2027-01-31');
  assert.equal(t.reverse, undefined);
  assert.equal(t.kcal, t.tdee);
});

test('NUT-4: weekly cuts never pass the Ramadan limit, and none while fasting under a gate', () => {
  const d = auditBase();
  d.goals[0].kcal_adjust = [{ on: '2027-01-01', kcal: -200 }, { on: '2027-01-22', kcal: -200 }];
  const plain = macroTargets(d, N, '2027-01-31');
  assert.ok(plain.deficit <= plain.tdee * 0.25 + 1);
  d.diet = { ...d.diet, ramadan: { from: '2027-02-08', to: '2027-03-09' } };
  const fast = macroTargets(d, N, '2027-02-10');
  assert.ok(fast.ramadan);
  assert.ok(fast.deficit <= fast.tdee * 0.15 + 1, `deficit ${fast.deficit} of ${fast.tdee}`);
  const no = Object.fromEntries(QUESTIONS.map((q) => [q.key, false]));
  const diabetic = applyScreening(d, { ...no, diabetes: true }, '2027-02-01');
  assert.equal(macroTargets(diabetic, N, '2027-02-10').deficit, 0);
});

test('UX-3: a new direction starts a fresh goal, so old cuts and the old start date do not come back', () => {
  const d = auditBase();
  d.goals[0].kcal_adjust = [{ on: '2027-01-01', kcal: -150 }];
  d.goals[0].kcal_check_kept_on = '2027-01-10';
  const form = { start_weight_kg: 95, goal_weight_low_kg: 99, goal_weight_high_kg: 101, goal_date: '2027-12-01' };
  const gain = saveProfile(d, { ...form, direction: 'gain' }, '2027-02-01');
  assert.equal(gain.goals.length, 2);
  assert.equal(gain.goals[0].ended_on, '2027-02-01');
  const g = gain.goals[1];
  assert.equal(g.direction, 'gain');
  assert.equal(g.set_on, '2027-02-01');
  assert.equal(g.kcal_adjust, undefined);
  assert.equal(g.kcal_check_kept_on, undefined);
  const back = saveProfile(gain, { ...form, goal_weight_low_kg: 80, goal_weight_high_kg: 82, direction: 'lose' }, '2027-02-02');
  assert.equal(back.goals.length, 3);
  assert.equal(macroTargets(back, N, '2027-02-02').adjust, undefined);
  // The same direction with new numbers edits the goal in place.
  const tweak = saveProfile(d, { ...form, goal_weight_low_kg: 78, goal_weight_high_kg: 80, direction: 'lose' }, '2027-02-01');
  assert.equal(tweak.goals.length, 1);
  assert.equal(tweak.goals[0].target_low_kg, 78);
  assert.deepEqual(tweak.goals[0].kcal_adjust, [{ on: '2027-01-01', kcal: -150 }]);
});
