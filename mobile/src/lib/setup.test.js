// First-time setup (E5-S2, E4-S7).
import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import { macroTargets } from './macros.js';
import { activeBlock } from './plan.js';
import { bodyComplete, bodyErrors, finishSetup, needsSetup, pickRoutine, settleSetup, setupGoalDate, skipSetup } from './setup.js';
import { content } from './testContent.js';

const TODAY = '2026-11-10';
const BODY = { gender: 'male', birth_year: 1996, height_cm: 178, weight_kg: 84 };

test('only a fresh phone sees setup', () => {
  const d = emptyData(content);
  assert.equal(needsSetup(d), true);
  assert.equal(needsSetup({ ...d, profile: { height_cm: 180 } }), false);
  assert.equal(needsSetup({ ...d, workouts: [{ id: 1 }] }), false);
  assert.equal(needsSetup({ ...d, body_logs: [{ id: 1 }] }), false);
  assert.equal(needsSetup(skipSetup(d, TODAY)), false);
});

test('the plan picked for me: a 12-row table', () => {
  const rows = [
    [{ where: 'home', days: 3, experience: 'new' }, 'home-3'],
    [{ where: 'home', days: 5, experience: 'some' }, 'home-3'],
    [{ where: 'gym', days: 2, experience: 'new' }, 'starter-3'],
    [{ where: 'gym', days: 3, experience: 'new' }, 'starter-3'],
    [{ where: 'gym', days: 4, experience: 'new' }, 'starter-3'], // 4 days + new: full body
    [{ where: 'gym', days: 5, experience: 'new' }, 'starter-3'],
    [{ where: 'gym', days: 2, experience: 'some' }, 'ppl-3'],
    [{ where: 'gym', days: 3, experience: 'some' }, 'ppl-3'],
    [{ where: 'gym', days: 4, experience: 'some' }, 'upper-lower-4'],
    [{ where: 'gym', days: 5, experience: 'some' }, 'body-part-5'],
    [{ where: 'gym', days: 6, experience: 'some' }, 'body-part-5'],
    [{}, 'starter-3'],
  ];
  for (const [answers, id] of rows) assert.equal(pickRoutine(answers), id, JSON.stringify(answers));
  const ids = new Set(content.training.routines.map((r) => r.id));
  for (const [, id] of rows) assert.ok(ids.has(id), `${id} is a real routine`);
});

test('a goal date at 0.5% of body weight a week', () => {
  assert.equal(setupGoalDate(84, 80, TODAY), '2027-01-16'); // 4 kg at 0.42 kg a week: 67 days
  assert.equal(setupGoalDate(84, 90, TODAY), null);
  assert.equal(setupGoalDate(null, 80, TODAY), null);
});

test('full answers: profile, goal, routine from today, kcal shown', () => {
  const d = finishSetup(emptyData(content), content, { ...BODY, goal: 'recomp', goal_kg: 80, where: 'gym', days: 4, experience: 'some' }, TODAY);
  assert.equal(d.profile.gender, 'male');
  assert.equal(d.goals.at(-1).direction, 'recomp');
  assert.equal(d.goals.at(-1).target_date, '2027-01-16');
  assert.equal(activeBlock(d).template_id, 'upper-lower-4');
  assert.equal(activeBlock(d).started_on, TODAY);
  assert.equal(d.safety.hide_kcal, false);
  assert.deepEqual(d.setup, { done_on: TODAY, routine: 'upper-lower-4', needs_body: false, skipped: false });
  const m = macroTargets(d, content.nutrition, TODAY);
  assert.equal(m.source, 'profile');
  assert.equal(m.mode, 'recomp');
  assert.equal(m.protein, 176, '2.2 g/kg of the 80 kg goal');
});

test('skipping the body screen hides kcal and leaves a note until the profile is filled', () => {
  let d = finishSetup(emptyData(content), content, { goal: 'lose', where: 'home' }, TODAY);
  assert.equal(d.safety.hide_kcal, true);
  assert.equal(d.setup.needs_body, true);
  assert.equal(d.goals[0].direction, 'lose');
  assert.equal(activeBlock(d).template_id, 'home-3');
  assert.equal(settleSetup(d), d, 'nothing changes while the profile is empty');
  d = { ...d, profile: { gender: 'female', date_of_birth: '1999-01-01', height_cm: 165 } };
  const settled = settleSetup(d);
  assert.equal(settled.safety.hide_kcal, false);
  assert.equal(settled.setup.needs_body, false);
});

test('skip all: nothing set, kcal hidden', () => {
  const d = skipSetup(emptyData(content), TODAY);
  assert.equal(d.profile, null);
  assert.equal(d.safety.hide_kcal, true);
  assert.equal(d.setup.skipped, true);
});

test('impossible body facts are caught at the boundaries (QA-06)', () => {
  const e = (a) => Object.keys(bodyErrors(a, TODAY)).sort();
  assert.deepEqual(e({ birth_year: 2010 }), [], 'age 16 is in');
  assert.deepEqual(e({ birth_year: 2011 }), ['birth_year'], 'age 15 is out');
  assert.deepEqual(e({ birth_year: 2015 }), ['birth_year'], 'QA repro: age 11');
  assert.deepEqual(e({ birth_year: 1936 }), [], 'age 90 is in');
  assert.deepEqual(e({ birth_year: 1935 }), ['birth_year']);
  assert.deepEqual(e({ height_cm: 17.8 }), ['height_cm'], 'QA repro: 17.8 for 178');
  assert.deepEqual(e({ height_cm: 120 }), []);
  assert.deepEqual(e({ height_cm: 231 }), ['height_cm']);
  assert.deepEqual(e({ weight_kg: 6 }), ['weight_kg'], 'QA repro: 6 kg');
  assert.deepEqual(e({ weight_kg: 35 }), []);
  assert.deepEqual(e({ weight_kg: 251 }), ['weight_kg']);
  assert.deepEqual(e({ weight_kg: 84, goal_kg: 84 }), ['goal_kg'], 'a goal at your weight is not a cut');
  assert.deepEqual(e({ weight_kg: 84, goal_kg: 30 }), ['goal_kg']);
  assert.deepEqual(e({ weight_kg: 84, goal_kg: 78 }), []);
});

test('out-of-range facts never become targets', () => {
  assert.equal(bodyComplete({ ...BODY, weight_kg: 6 }, TODAY), false);
  const d = finishSetup(emptyData(content), content, { ...BODY, weight_kg: 6, goal: 'lose' }, TODAY);
  assert.equal(d.safety.hide_kcal, true, 'kcal hidden, never Yusuf\'s plan numbers');
  assert.equal(d.setup.needs_body, true);
});

test('under 18: no deficit, whatever goal was picked', () => {
  const d = finishSetup(emptyData(content), content, { ...BODY, birth_year: 2009, weight_kg: 70, goal: 'lose', goal_kg: 62 }, TODAY);
  assert.equal(d.setup.minor, true);
  assert.equal(d.goals.at(-1).direction, 'maintain');
  const m = macroTargets(d, content.nutrition, TODAY);
  assert.notEqual(m.mode, 'lose');
  assert.ok(m.kcal >= m.tdee - 1, `kcal ${m.kcal} is maintenance (tdee ${m.tdee})`);
});
