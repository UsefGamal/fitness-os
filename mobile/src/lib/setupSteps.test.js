import assert from 'node:assert/strict';
import test from 'node:test';

import { QUESTIONS } from './safety.js';
import {
  afterSafety, ageChoices, ageFor, birthYearFor, goalChange, goalStart, nextStep, pickerStart, prevStep, progressOf,
  projectionPoints, setupSteps, snap,
} from './setupSteps.js';

const TODAY = '2026-11-19';
test('the safety check is one screen, before the goal, gone when skipped', () => {
  for (const gender of ['male', 'female', null, undefined]) {
    const s = setupSteps({ gender }, TODAY);
    assert.equal(s.filter((x) => x === 'safety').length, 1);
    assert.ok(s.indexOf('weight') < s.indexOf('safety') && s.indexOf('safety') < s.indexOf('goal'), 'the check comes before the goal, so a held cut shows there');
  }
  const yes = setupSteps({ gender: 'male', screening: { injury: true } }, TODAY);
  assert.ok(!yes.includes('injury_areas'), 'the injury areas are on the same screen');
  assert.equal(afterSafety(yes), 'goal');
  const skipped = setupSteps({ gender: 'female', screening: null }, TODAY);
  assert.ok(!skipped.includes('safety'));
  assert.equal(afterSafety(skipped), 'goal');
});

test('the time is on the Done screen; the job keeps its own screen', () => {
  const s = setupSteps({ gender: 'male' }, TODAY);
  assert.ok(!s.includes('time'));
  assert.equal(s[s.length - 2], 'job');
  assert.ok(s.length <= 13, `${s.length} screens`);
});

test('goal weight and the chart only for a cut with a weight and a lower goal', () => {
  assert.ok(!setupSteps({ goal: 'maintain', weight_kg: 80 }, TODAY).includes('goal_weight'));
  assert.ok(!setupSteps({ goal: 'lose' }, TODAY).includes('goal_weight'), 'no weight, nothing to aim under');
  const cut = setupSteps({ goal: 'lose', weight_kg: 80 }, TODAY);
  assert.ok(cut.includes('goal_weight') && !cut.includes('projection'));
  const ALL_NO = Object.fromEntries(QUESTIONS.map((q) => [q.key, false]));
  const withGoal = setupSteps({ goal: 'recomp', weight_kg: 80, goal_kg: 74, screening: ALL_NO }, TODAY);
  assert.equal(withGoal[withGoal.indexOf('goal_weight') + 1], 'projection');
  assert.ok(!setupSteps({ goal: 'lose', weight_kg: 80, goal_kg: 74, screening: null }, TODAY).includes('projection'), 'check skipped: no cut to draw');
  assert.ok(!setupSteps({ goal: 'lose', weight_kg: 80, goal_kg: 74, gender: 'female', screening: { ...ALL_NO, pregnant: true } }, TODAY).includes('projection'), 'pregnant: no cut to draw');
  assert.ok(!setupSteps({ goal: 'lose', weight_kg: 80, birth_year: 2011 }, TODAY).includes('goal_weight'), 'under 18: no cut');
});

test('order: welcome first, done last, body before goal', () => {
  const s = setupSteps({ gender: 'male' }, TODAY);
  assert.equal(s[0], 'welcome');
  assert.equal(s.at(-1), 'done');
  assert.ok(s.indexOf('experience') < s.indexOf('days'), 'the plan card on days knows the experience');
  assert.equal(nextStep(s, 'sex'), 'age');
  assert.equal(prevStep(s, 'sex'), 'name');
  assert.equal(prevStep(s, 'welcome'), 'welcome');
  assert.equal(nextStep(s, 'done'), 'done');
  assert.equal(nextStep(s, 'gone'), 'welcome');
});

test('the bar leaves out the welcome screen', () => {
  const s = setupSteps({ gender: 'male' }, TODAY);
  assert.deepEqual(progressOf(s, 'name'), { at: 0, of: s.length - 1 });
  assert.equal(progressOf(s, 'done').at, s.length - 2);
});

test('pickers snap to their step and range', () => {
  assert.equal(snap(80.04, { min: 35, max: 250, step: 0.1 }), 80);
  assert.equal(snap(80.06, { min: 35, max: 250, step: 0.1 }), 80.1);
  assert.equal(snap(300, { min: 35, max: 250, step: 0.1 }), 250);
  assert.equal(snap(10, { min: 120, max: 230, step: 1 }), 120);
  assert.deepEqual([ageChoices()[0], ageChoices().at(-1)], [16, 90]);
  assert.equal(birthYearFor(30, TODAY), 1996);
  assert.equal(ageFor(1996, TODAY), 30);
  assert.equal(ageFor(null, TODAY), null);
  assert.ok(pickerStart({ gender: 'female' }).height_cm < pickerStart({ gender: 'male' }).height_cm);
});

test('goal start, change and chart', () => {
  assert.equal(goalStart(80), 73.5);
  assert.equal(goalStart(36), 35);
  assert.deepEqual(goalChange(80, 72), { kg: 8, pct: 10 });
  assert.equal(goalChange(null, 72), null);
  const pts = projectionPoints(80, 72);
  assert.equal(pts[0].kg, 80);
  assert.equal(pts.at(-1).kg, 72);
  for (let i = 1; i < pts.length; i += 1) assert.ok(pts[i].kg <= pts[i - 1].kg, 'only ever down');
});
