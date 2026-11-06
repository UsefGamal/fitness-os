import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import * as D from './data.js';
import { isRecoveryWeek, recoveryDay, recoveryRir, recoverySets, setRecoveryWeek, weekOf, withoutRecovery } from './recovery.js';
import { content } from './testContent.js';

test('weeks start on the profile\'s day', () => {
  const d = emptyData(content);
  assert.equal(weekOf({ profile: { week_start: 'sun' } }, '2026-11-11'), '2026-11-08');
  assert.equal(weekOf({ profile: { week_start: 'mon' } }, '2026-11-11'), '2026-11-09');
  assert.equal(weekOf({ profile: { week_start: 'mon' } }, '2026-11-08'), '2026-11-02');
  assert.equal(weekOf(d, '2026-11-08'), '2026-11-08');
});

test('switching a recovery week on and off', () => {
  let d = emptyData(content);
  assert.equal(isRecoveryWeek(d, '2026-11-10'), false);
  d = setRecoveryWeek(d, '2026-11-10', true);
  assert.ok(isRecoveryWeek(d, '2026-11-08') && isRecoveryWeek(d, '2026-11-14'));
  assert.equal(isRecoveryWeek(d, '2026-11-15'), false, 'only that week');
  d = setRecoveryWeek(d, '2026-11-10', true);
  assert.equal(d.program.blocks[0].deload_weeks.length, 1, 'no duplicates');
  d = setRecoveryWeek(d, '2026-11-12', false);
  assert.equal(isRecoveryWeek(d, '2026-11-10'), false);
  assert.equal(setRecoveryWeek({ program: null }, '2026-11-10', true).program, null);
});

test('a third fewer sets, same exercises, RIR + 2', () => {
  assert.deepEqual([4, 3, 2, 1, 0].map(recoverySets), [3, 2, 1, 1, 0]);
  assert.equal(recoveryRir('1-2'), '3-4');
  assert.equal(recoveryRir(0), '2');
  assert.equal(recoveryRir(null), '2-3');
  const day = { key: 'upper', exercises: [{ name: 'A', sets: 4, reps: '8-10', rir: '1-2' }] };
  const r = recoveryDay(day);
  assert.equal(r.recovery, true);
  assert.deepEqual(r.exercises[0], { name: 'A', sets: 3, reps: '8-10', rir: '3-4' });
  assert.equal(day.exercises[0].sets, 4, 'the plan is not changed');
});

test('recovery sessions are marked and left out of progression', () => {
  let d = emptyData(content);
  let r = D.startWorkout(d, { date: '2026-11-08', sessionKey: 'upper', label: 'Upper', isDeload: true });
  assert.equal(r.data.workouts[0].is_deload, true);
  r = D.startWorkout(r.data, { date: '2026-11-15', sessionKey: 'upper', label: 'Upper' });
  d = r.data;
  assert.equal(d.workouts[1].is_deload, false);
  const history = [{ workoutId: d.workouts[0].id }, { workoutId: d.workouts[1].id }];
  assert.deepEqual(withoutRecovery(history, d.workouts), [{ workoutId: d.workouts[1].id }]);
});
