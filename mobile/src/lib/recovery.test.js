import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import * as D from './data.js';
import { hardWeeksInARow, isRecoveryWeek, recoveryDay, recoveryDue, recoveryRir, recoverySets, setRecoveryWeek, weekOf, withoutRecovery } from './recovery.js';
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

test('Home suggests a recovery week after four hard weeks in a row (UX-05)', () => {
  const gym = (id, date, done = true) => ({ id, log_date: date, workout_type: 'gym', finished_at: done ? 1 : null, sets: [] });
  let d = { ...emptyData(content), workouts: [gym(1, '2026-10-13'), gym(2, '2026-10-20'), gym(3, '2026-10-27'), gym(4, '2026-11-03'), gym(5, '2026-11-10')] };
  assert.equal(hardWeeksInARow(d, '2026-11-11'), 4); // this week is not counted
  assert.equal(recoveryDue(d, '2026-11-11'), true);
  // A gap, an unfinished workout or an earlier recovery week breaks the run.
  assert.equal(hardWeeksInARow({ ...d, workouts: d.workouts.filter((w) => w.id !== 3) }, '2026-11-11'), 1);
  assert.equal(hardWeeksInARow({ ...d, workouts: d.workouts.map((w) => (w.id === 4 ? gym(4, '2026-11-03', false) : w)) }, '2026-11-11'), 0);
  assert.equal(hardWeeksInARow(setRecoveryWeek(d, '2026-10-27', true), '2026-11-11'), 1);
  // Already a recovery week: nothing to suggest.
  d = setRecoveryWeek(d, '2026-11-11', true);
  assert.equal(recoveryDue(d, '2026-11-11'), false);
  assert.equal(recoveryDue(emptyData(content), '2026-11-11'), false);
});
