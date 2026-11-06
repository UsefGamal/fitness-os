// Ready-made routines (E4-S18).
import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData, exerciseByName, startWorkout } from './data.js';
import { activeBlock, activePlan } from './plan.js';
import { routineById, routinesOf, startRoutine, templateOfBlock, trainingDays } from './routines.js';
import { sessionKeyOn } from './schedule.js';
import { content } from './testContent.js';

const TODAY = '2026-11-10'; // a Tuesday

test("the build's own plan comes first, then the five templates without a duplicate", () => {
  const list = routinesOf(content);
  assert.equal(list[0].own, true);
  assert.equal(list[0].id, content.training.trainer_plan.id);
  const ids = list.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['upper-lower-4', 'ppl-3', 'body-part-5', 'home-3']) assert.ok(ids.includes(id), id);
});

test('the body-part split trains five days, one muscle each', () => {
  const r = routineById(content, 'body-part-5');
  assert.deepEqual(trainingDays(r), ['sunday', 'monday', 'tuesday', 'thursday', 'friday']);
  assert.deepEqual(r.program.map((d) => d.label), ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms']);
});

test('switching starts a new block and the plan follows it from today', () => {
  let d = emptyData(content);
  d = { ...d, program: { ...d.program, blocks: d.program.blocks.map((b) => ({ ...b, started_on: '2026-11-01' })) } };
  const next = startRoutine(d, content, 'ppl-3', TODAY);
  const block = activeBlock(next);
  assert.equal(block.id, 'b2');
  assert.equal(block.template_id, 'ppl-3');
  assert.equal(block.started_on, TODAY);
  assert.equal(next.program.blocks[0].ended_on, '2026-11-09', 'the old block ends yesterday and stays');
  const T = activePlan(next, content);
  assert.equal(sessionKeyOn('2026-11-15', T), 'push'); // Sunday
  assert.equal(sessionKeyOn('2026-11-17', T), 'pull'); // Tuesday
  assert.equal(templateOfBlock(next, content).id, 'ppl-3');
});

test('a block started today with nothing logged is replaced, not kept', () => {
  const d = startRoutine(emptyData(content), content, 'ppl-3', TODAY);
  const again = startRoutine(d, content, 'home-3', TODAY);
  assert.equal(activeBlock(again).template_id, 'home-3');
  assert.equal(again.program.blocks.filter((b) => b.template_id === 'ppl-3').length, 0);
});

test('a block with workouts is kept even when it started today', () => {
  let d = startRoutine(emptyData(content), content, 'ppl-3', TODAY);
  d = startWorkout(d, { date: TODAY, sessionKey: 'pull', label: 'Pull' }).data;
  const next = startRoutine(d, content, 'home-3', TODAY);
  const ppl = next.program.blocks.find((b) => b.template_id === 'ppl-3');
  assert.equal(ppl.ended_on, TODAY);
  assert.equal(next.workouts[0].block_id, ppl.id, 'the workout keeps its block');
});

test('home moves are added to the Library so they can be logged', () => {
  const d = emptyData(content);
  assert.equal(exerciseByName(d, 'Pike Push-up'), null);
  const next = startRoutine(d, content, 'home-3', TODAY);
  const pike = exerciseByName(next, 'Pike Push-up');
  assert.equal(pike.muscle_group, 'Shoulders');
  assert.equal(pike.custom, true);
  assert.equal(next.exercises.length, new Set(next.exercises.map((e) => e.name)).size, 'no duplicates');
});

test('one-off day changes from today on are dropped, older ones kept', () => {
  const d = { ...emptyData(content), session_moves: [{ from: null, to: '2026-11-08', key: 'rest' }, { from: null, to: '2026-11-12', key: 'rest' }] };
  const next = startRoutine(d, content, 'ppl-3', TODAY);
  assert.deepEqual(next.session_moves.map((m) => m.to), ['2026-11-08']);
});

test('going back to an earlier plan brings its exercise edits back', () => {
  const own = content.training.trainer_plan.id;
  let d = emptyData(content);
  d = { ...d, program: { ...d.program, blocks: d.program.blocks.map((b) => ({ ...b, started_on: '2026-11-01', overrides: { x: [{ name: 'Hack Squat' }] } })) } };
  d = startRoutine(d, content, 'ppl-3', '2026-11-05');
  d = startRoutine(d, content, own, TODAY);
  assert.deepEqual(activeBlock(d).overrides, { x: [{ name: 'Hack Squat' }] });
});

test('an unknown routine changes nothing', () => {
  const d = emptyData(content);
  assert.equal(startRoutine(d, content, 'nope', TODAY), d);
});
