// activePlan() (E4-S1): one place decides which plan runs.
import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import { activeBlock, activePlan, planOverrides, withPlanOverrides } from './plan.js';
import * as P from './planEdit.js';
import { sessionKeyOn } from './schedule.js';
import { content } from './testContent.js';

test('a new install runs a copy of the content plan', () => {
  const d = emptyData(content);
  assert.equal(activeBlock(d).id, 'b1');
  const T = activePlan(d, content);
  assert.deepEqual(T.program, content.training.program);
  assert.deepEqual(T.trainer_plan.schedule, content.training.trainer_plan.schedule);
  assert.equal(T.exercise_photos, content.training.exercise_photos, 'everything else is the content as is');
});

test('a later content change does not rewrite the plan someone follows', () => {
  const d = emptyData(content);
  const changed = structuredClone(content);
  changed.training.program[0].label = 'Renamed upstream';
  changed.training.trainer_plan.schedule[0].session = 'rest';
  const T = activePlan(d, changed);
  assert.equal(T.program[0].label, content.training.program[0].label);
  assert.equal(sessionKeyOn('2026-11-08', T), content.training.trainer_plan.schedule[0].session);
});

test('data without a block falls back to the content and the v1 key', () => {
  const v1 = { plan_overrides: { lower: [{ name: 'Hack Squat' }] } };
  assert.equal(activeBlock(v1), null);
  assert.equal(activePlan(v1, content), content.training);
  assert.equal(planOverrides(v1).lower[0].name, 'Hack Squat');
  assert.deepEqual(withPlanOverrides(v1, {}).plan_overrides, {});
  assert.deepEqual(planOverrides({}), {});
  assert.equal(activeBlock({ program: { blocks: [] } }), null);
});

test('edits land on the active block only', () => {
  const d = emptyData(content);
  const two = { ...d, program: { ...d.program, active_block: 'b2', blocks: [{ ...d.program.blocks[0], ended_on: '2026-11-01' }, { ...d.program.blocks[0], id: 'b2', overrides: {} }] } };
  const edited = P.editExercise(two, 'lower', activePlan(two, content), 0, { sets: 5 });
  assert.equal(edited.program.blocks[1].overrides.lower[0].sets, 5);
  assert.deepEqual(edited.program.blocks[0].overrides, {});
  assert.equal('plan_overrides' in edited, false);
  // With no active_block set, the open block is the one that runs.
  const open = { ...two, program: { ...two.program, active_block: undefined } };
  assert.equal(activeBlock(open).id, 'b2');
});

// ── My week: the session on each weekday (friend feedback, 6 Nov 2026) ──
import { isWeekEdited, resetWeek, setWeekday } from './plan.js';

test('setting a weekday changes every week from then on', () => {
  const d = setWeekday(emptyData(content), content, 'tuesday', 'pull');
  const T = activePlan(d, content);
  assert.equal(sessionKeyOn('2026-11-03', T), 'pull');
  assert.equal(sessionKeyOn('2026-11-10', T), 'pull');
  assert.equal(sessionKeyOn('2026-11-05', T), 'pull', 'Thursday keeps its own session');
  assert.ok(isWeekEdited(d, content));
});

test('the week edit lives on the block and survives a content update', () => {
  const d = setWeekday(emptyData(content), content, 'sunday', 'rest');
  const changed = structuredClone(content);
  changed.training.trainer_plan.schedule[0].session = 'push';
  assert.equal(sessionKeyOn('2026-11-01', activePlan(d, changed)), 'rest');
});

test('a week with no training day is refused', () => {
  let d = emptyData(content);
  for (const day of ['sunday', 'monday', 'wednesday', 'thursday']) d = setWeekday(d, content, day, 'rest');
  const before = d;
  assert.equal(setWeekday(d, content, 'friday', 'rest'), before);
});

test('reset puts the template week back', () => {
  const d = resetWeek(setWeekday(emptyData(content), content, 'monday', 'push'), content);
  assert.deepEqual(activeBlock(d).schedule, content.training.trainer_plan.schedule);
  assert.equal(isWeekEdited(d, content), false);
});

test('an unknown weekday or data without a block changes nothing', () => {
  const d = emptyData(content);
  assert.equal(setWeekday(d, content, 'funday', 'push'), d);
  const bare = { workouts: [] };
  assert.equal(setWeekday(bare, content, 'monday', 'push'), bare);
  assert.equal(isWeekEdited(bare, content), false);
});
