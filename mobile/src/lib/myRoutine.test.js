// Make my own routine (E4-S17).
import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData, exerciseByName } from './data.js';
import { activeBlock, activePlan, withPlanOverrides } from './plan.js';
import * as P from './planEdit.js';
import * as M from './myRoutine.js';
import { sessionKeyOn } from './schedule.js';
import { content } from './testContent.js';

const fresh = () => emptyData(content);

test('a new session is saved on the running block and the plan can run it', () => {
  const { data, key } = M.createSession(fresh(), '  Arms and abs  ');
  assert.equal(key, 'my_1');
  const s = M.mySession(data, key);
  assert.equal(s.label, 'Arms and abs');
  assert.equal(s.custom, true);
  const T = activePlan(data, content);
  assert.ok(T.program.some((d) => d.key === key));
  assert.equal(P.effectiveDay(key, T, data).label, 'Arms and abs');
});

test('names are trimmed, capped, and an empty name is refused', () => {
  assert.equal(M.createSession(fresh(), '   ').key, null);
  const { data, key } = M.createSession(fresh(), 'x'.repeat(80));
  assert.equal(M.mySession(data, key).label.length, M.MAX_NAME);
  assert.equal(M.renameSession(data, key, ''), data);
  assert.equal(M.mySession(M.renameSession(data, key, 'Pump'), key).label, 'Pump');
});

test('keys never clash', () => {
  let d = fresh();
  d = M.createSession(d, 'A').data;
  d = M.createSession(d, 'B').data;
  d = M.deleteSession(d, 'my_1');
  const { key } = M.createSession(d, 'C');
  assert.equal(key, 'my_1');
  assert.deepEqual(M.mySessions(M.createSession(d, 'C').data).map((s) => s.key), ['my_2', 'my_1']);
});

test('adding an exercise puts a new one in the Library so it can be logged', () => {
  let { data, key } = M.createSession(fresh(), 'Mine');
  data = M.addExercise(data, key, { name: 'Cable Fly', group: 'Chest', equipment: 'cable' });
  data = M.addExercise(data, key, { name: 'Bench Press', group: 'Chest' });
  assert.equal(exerciseByName(data, 'Cable Fly').muscle_group, 'Chest');
  assert.equal(data.exercises.filter((e) => e.name === 'Bench Press').length, 1);
  const ex = M.mySession(data, key).exercises;
  assert.deepEqual(ex.map((x) => x.name), ['Cable Fly', 'Bench Press']);
  assert.deepEqual(ex[0], { name: 'Cable Fly', sets: 3, reps: '8-12', rest: '90s', rest_sec: 90, rir: '2-3', type: 'normal' });
  assert.equal(M.addExercise(data, key, { name: ' ' }), data);
  assert.equal(M.addExercise(data, 'upper', { name: 'X' }), data, "the plan's own sessions are not edited here");
});

test('sets, reps and rest are kept in range', () => {
  let { data, key } = M.createSession(fresh(), 'Mine');
  data = M.addExercise(data, key, { name: 'Bench Press' });
  data = M.setExercise(data, key, 0, { sets: 14, reps: ' 5 ', restSec: 120 });
  assert.deepEqual(M.mySession(data, key).exercises[0], { ...M.row('Bench Press'), sets: 10, reps: '5', rest: '2m', rest_sec: 120 });
  data = M.setExercise(data, key, 0, { sets: 0, reps: '' });
  assert.equal(M.mySession(data, key).exercises[0].sets, 1);
  assert.equal(M.mySession(data, key).exercises[0].reps, '5');
});

test('reorder and remove', () => {
  let { data, key } = M.createSession(fresh(), 'Mine');
  for (const name of ['A', 'B', 'C']) data = M.addExercise(data, key, { name });
  data = M.moveExercise(data, key, 2, -1);
  assert.deepEqual(M.mySession(data, key).exercises.map((x) => x.name), ['A', 'C', 'B']);
  assert.deepEqual(M.mySession(M.moveExercise(data, key, 0, -1), key).exercises, M.mySession(data, key).exercises);
  data = M.removeExercise(data, key, 0);
  assert.deepEqual(M.mySession(data, key).exercises.map((x) => x.name), ['C', 'B']);
});

test('put it on weekdays: days it leaves become rest days', () => {
  let { data, key } = M.createSession(fresh(), 'Mine');
  data = M.setDays(data, key, ['monday', 'friday', 'nonsense']);
  assert.deepEqual(M.daysOf(data, key), ['monday', 'friday']);
  const T = activePlan(data, content);
  assert.equal(sessionKeyOn('2026-11-09', T), key); // Monday
  data = M.setDays(data, key, ['friday']);
  assert.equal(activeBlock(data).schedule.find((e) => e.day === 'monday').session, 'rest');
  assert.equal(activeBlock(data).schedule.length, 7);
});

test('delete frees its days and its edits', () => {
  let { data, key } = M.createSession(fresh(), 'Mine');
  data = M.setDays(data, key, ['saturday']);
  data = M.deleteSession(data, key);
  assert.deepEqual(M.mySessions(data), []);
  assert.equal(activeBlock(data).schedule.find((e) => e.day === 'saturday').session, 'rest');
});

test("an edit from the Plan page's Edit list shows here and folds in on the next change", () => {
  let { data, key } = M.createSession(fresh(), 'Mine');
  data = M.addExercise(data, key, { name: 'A' });
  data = withPlanOverrides(data, { [key]: [M.row('Z')] });
  assert.deepEqual(M.mySession(data, key).exercises.map((x) => x.name), ['Z']);
  data = M.addExercise(data, key, { name: 'B' });
  assert.deepEqual(M.mySession(data, key).exercises.map((x) => x.name), ['Z', 'B']);
  assert.equal(activeBlock(data).overrides[key], undefined);
});

test('sets per group, biggest first', () => {
  let { data, key } = M.createSession(fresh(), 'Mine');
  data = M.addExercise(data, key, { name: 'Bench Press' });
  data = M.addExercise(data, key, { name: 'Dumbbell Curl' });
  data = M.addExercise(data, key, { name: 'Incline Dumbbell Press' });
  assert.deepEqual(M.setsByGroup(data, M.mySession(data, key).exercises), [['Chest', 6], ['Arms', 3]]);
});

test('data without a block is left alone', () => {
  const d = { exercises: [], workouts: [] };
  assert.deepEqual(M.createSession(d, 'X'), { data: d, key: null });
  assert.deepEqual(M.mySessions(d), []);
  assert.deepEqual(M.daysOf(d, 'x'), []);
});
