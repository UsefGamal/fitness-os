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
