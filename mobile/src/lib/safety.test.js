import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyData } from './data.js';
import { macroTargets, saveProfile } from './macros.js';
import {
  GATES, PROTEIN_CAP_G_PER_KG, QUESTIONS, SCREEN_VERSION, allowedDirections, answeredAll, applyScreening, capProtein,
  celebratesWeightLoss, gateOn, gentleDay, gentleRir, gatesOn, isMinorNow, kcalHidden, markClearanceSeen, needsScreening, safeMode,
  screeningResult, screeningState, setHide, showClearance, skipScreening,
} from './safety.js';
import { content } from './testContent.js';

const TODAY = '2026-11-12';
const NO = Object.fromEntries(QUESTIONS.map((q) => [q.key, false]));
const adult = (over = {}) => ({
  ...emptyData(content),
  profile: { gender: 'male', date_of_birth: '1990-06-01', height_cm: 180, activity_level: 'moderate' },
  goals: [{ id: 'g1', set_on: '2026-10-01', direction: 'lose', start_weight_kg: 90, target_low_kg: 79, target_high_kg: 81, target_date: '2027-03-01', ended_on: null }],
  body_logs: [{ log_date: '2026-11-10', weight_kg: 90 }],
  diet: { mode: 'plan', plan_start_date: '2026-10-01', ramadan: { from: null, to: null } },
  ...over,
});

test('every question names real gates and hide switches', () => {
  assert.equal(QUESTIONS.length, 7);
  for (const q of QUESTIONS) {
    for (const g of q.gates) assert.ok(GATES.includes(g), `${q.key}: ${g}`);
    for (const h of q.hides) assert.ok(['hide_weight', 'hide_kcal'].includes(h));
    assert.ok(q.gates.length + q.hides.length > 0);
  }
  for (const g of GATES) assert.ok(QUESTIONS.some((q) => q.gates.includes(g)), `${g} can be switched on`);
});

test('all no: nothing on; a yes switches on its gates; no answer counts as yes', () => {
  assert.deepEqual(screeningResult(NO), { gates: Object.fromEntries(GATES.map((g) => [g, false])), hides: [] });
  const preg = screeningResult({ ...NO, pregnant: true });
  assert.equal(preg.gates.no_deficit, true);
  assert.equal(preg.gates.no_fasting_deficit, true);
  assert.equal(preg.gates.protein_cap, false);
  assert.deepEqual(screeningResult({ ...NO, eating: true }).hides, ['hide_weight', 'hide_kcal']);
  assert.equal(screeningResult({ ...NO, kidney: true }).gates.protein_cap, true);
  const missing = { ...NO };
  delete missing.heart;
  assert.equal(screeningResult(missing).gates.needs_clearance, true);
  assert.equal(answeredAll(missing), false);
  assert.equal(answeredAll(NO), true);
  assert.ok(Object.values(screeningResult({}).gates).every(Boolean), 'no answers at all: everything on');
});

test('only flags are stored, never the answers', () => {
  const d = applyScreening(adult(), { ...NO, kidney: true, eating: true }, TODAY);
  assert.equal(d.safety.screen_version, SCREEN_VERSION);
  assert.equal(d.safety.screened_on, TODAY);
  assert.equal(d.safety.skipped, false);
  assert.equal(d.safety.hide_weight, true);
  assert.equal(d.safety.hide_kcal, true);
  const text = JSON.stringify(d.safety);
  for (const q of QUESTIONS) assert.ok(!text.includes(`"${q.key}"`), `${q.key} is not in the data`);
  assert.equal(needsScreening(d), false);
  assert.equal(needsScreening(adult()), true);
  assert.equal(needsScreening(null), false);
});

test('a later all-clear switches the gates off but leaves the hide switches alone', () => {
  let d = applyScreening(adult(), { ...NO, eating: true }, TODAY);
  d = applyScreening(d, NO, TODAY);
  assert.deepEqual(gatesOn(d, TODAY), []);
  assert.equal(d.safety.hide_weight, true, "the person's own switch stays");
  assert.equal(setHide(d, 'hide_weight', false).safety.hide_weight, false);
  assert.equal(setHide(d, 'gates', true), d);
});

test('skipped is gated: every limit on and kcal hidden, until the check is done', () => {
  const d = skipScreening(adult(), TODAY);
  assert.deepEqual(gatesOn(d, TODAY), GATES);
  assert.equal(kcalHidden(d), true);
  assert.equal(screeningState(d, TODAY), 'skipped');
  assert.equal(showClearance(d, TODAY), false, 'no doctor note for someone who only skipped');
  const done = applyScreening(d, NO, TODAY);
  assert.equal(kcalHidden(done), false);
  assert.equal(screeningState(done, TODAY), 'clear');
  assert.equal(screeningState(adult(), TODAY), 'none');
  assert.equal(screeningState(applyScreening(adult(), { ...NO, injury: true }, TODAY), TODAY), 'limits');
});

test('no_deficit: a cut becomes maintenance in the calorie maths', () => {
  const open = applyScreening(adult(), NO, TODAY);
  const cut = macroTargets(open, content.nutrition, TODAY);
  assert.equal(cut.mode, 'lose');
  assert.ok(cut.deficit > 0);
  assert.equal(cut.gated, undefined);
  const gated = macroTargets(applyScreening(adult(), { ...NO, pregnant: true }, TODAY), content.nutrition, TODAY);
  assert.equal(gated.mode, 'maintain');
  assert.equal(gated.deficit, 0);
  assert.equal(gated.kcal, cut.tdee);
  assert.deepEqual(gated.gated, ['no_deficit']);
  assert.equal(safeMode(open, 'gain', TODAY), 'gain');
  assert.equal(safeMode(skipScreening(adult(), TODAY), 'recomp', TODAY), 'maintain');
  assert.deepEqual(allowedDirections(skipScreening(adult(), TODAY), ['lose', 'recomp', 'maintain', 'gain'], TODAY), ['maintain', 'gain']);
  assert.deepEqual(allowedDirections(open, ['lose', 'gain'], TODAY), ['lose', 'gain']);
});

test('data that never met the check keeps its numbers until it is asked', () => {
  // The app asks before anything else (needsScreening), so this state is
  // never used for long; Yusuf's own numbers must not move on an update.
  const m = macroTargets(adult(), content.nutrition, TODAY);
  assert.equal(m.mode, 'lose');
  assert.equal(m.gated, undefined);
});

test('protein cap: at most 1.2 g per kg of the weight today, carbs take the rest', () => {
  const open = macroTargets(applyScreening(adult(), NO, TODAY), content.nutrition, TODAY);
  const capped = macroTargets(applyScreening(adult(), { ...NO, kidney: true }, TODAY), content.nutrition, TODAY);
  assert.equal(capped.protein, Math.round(90 * PROTEIN_CAP_G_PER_KG));
  assert.ok(capped.protein < open.protein);
  assert.equal(capped.kcal, open.kcal);
  assert.ok(capped.carbs > open.carbs);
  assert.ok(Math.abs(capped.protein * 4 + capped.carbs * 4 + capped.fat * 9 - capped.kcal) <= 4);
  assert.deepEqual(capped.gated, ['protein_cap']);
  assert.equal(capProtein(open, 200, 90, TODAY), 200);
  assert.equal(capProtein(skipScreening(adult(), TODAY), 50, 90, TODAY), 50, 'never raises protein');
  assert.equal(capProtein(skipScreening(adult(), TODAY), 200, null, TODAY), 200);
});

test('under 18 is worked out from the birth date, whatever the answers', () => {
  const teen = applyScreening(adult({ profile: { gender: 'male', date_of_birth: '2010-01-01', height_cm: 170, activity_level: 'moderate' } }), NO, TODAY);
  assert.equal(isMinorNow(teen, TODAY), true);
  assert.equal(gateOn(teen, 'no_deficit', TODAY), true);
  assert.equal(gateOn(teen, 'beginner_only', TODAY), true);
  assert.equal(gateOn(teen, 'protein_cap', TODAY), false);
  assert.equal(macroTargets(teen, content.nutrition, TODAY).mode, 'maintain');
  assert.equal(isMinorNow(teen, '2028-01-02'), false, 'the gate lifts on the 18th birthday');
  assert.equal(isMinorNow(adult(), TODAY), false);
  assert.equal(isMinorNow({ profile: null }, TODAY), false);
  // Profile can't save a cut for an under-18 (age re-checked on save).
  const saved = saveProfile(adult(), { date_of_birth: '2010-01-01', direction: 'lose' }, TODAY);
  assert.equal(saved.goals.at(-1).direction, 'maintain');
  assert.equal(saveProfile(adult(), { date_of_birth: '2010-01-01', direction: 'gain' }, TODAY).goals.at(-1).direction, 'gain');
  assert.equal(saveProfile(adult(), { direction: 'recomp' }, TODAY).goals.at(-1).direction, 'recomp');
});

test('weight loss is not cheered while weight is hidden or a cut is off', () => {
  const open = applyScreening(adult(), NO, TODAY);
  assert.equal(celebratesWeightLoss(open, TODAY), true);
  assert.equal(celebratesWeightLoss(setHide(open, 'hide_weight', true), TODAY), false);
  assert.equal(celebratesWeightLoss(applyScreening(adult(), { ...NO, pregnant: true }, TODAY), TODAY), false);
});

test('the doctor note shows until the person says they have checked', () => {
  const d = applyScreening(adult(), { ...NO, bp_meds: true }, TODAY);
  assert.equal(showClearance(d, TODAY), true);
  const seen = markClearanceSeen(d);
  assert.equal(showClearance(seen, TODAY), false);
  assert.equal(showClearance(applyScreening(seen, { ...NO, heart: true }, TODAY), TODAY), false, 'stays answered while still flagged');
  const cleared = applyScreening(seen, NO, TODAY);
  assert.equal(cleared.safety.clearance_seen, undefined);
  assert.equal(showClearance(applyScreening(adult(), NO, TODAY), TODAY), false);
});

test('beginner_only: every set stops at least 3 reps short of failure', () => {
  assert.equal(gentleRir('1-2'), '3');
  assert.equal(gentleRir('2-4'), '3-4');
  assert.equal(gentleRir('0'), '3');
  assert.equal(gentleRir(4), '4');
  assert.equal(gentleRir(null), '3');
  assert.equal(gentleRir(''), '3');
  const day = { key: 'a', exercises: [{ name: 'Squat', sets: 3, reps: '8-10', rir: '1-2' }, { name: 'Plank', sets: 2, reps: '30s' }] };
  const open = applyScreening(adult(), NO, TODAY);
  assert.equal(gentleDay(open, day, TODAY), day);
  const g = gentleDay(applyScreening(adult(), { ...NO, injury: true }, TODAY), day, TODAY);
  assert.deepEqual(g.exercises.map((e) => e.rir), ['3', '3']);
  assert.equal(g.gentle, true);
  assert.equal(day.exercises[0].rir, '1-2', 'the plan itself is untouched');
  assert.equal(gentleDay(open, null, TODAY), null);
});
