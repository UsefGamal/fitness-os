import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays } from './dates.js';
import * as D from './data.js';
import { betterRoutine, CHECKIN_SESSIONS, checkInDue, checkInExercises, finishCheckIn, snoozeCheckIn } from './checkIn.js';
import { activeBlock } from './plan.js';
import { routineById, startRoutine } from './routines.js';
import { finishSetup, withMainSet } from './setup.js';
import { content } from './testContent.js';

const START = '2026-09-06';
const on = (id, extra = {}) => {
  let d = startRoutine(D.emptyData(content), content, id, START);
  d = { ...d, ...extra };
  return d;
};
const trained = (d, n) => ({
  ...d,
  workouts: Array.from({ length: n }, (_, i) => ({ id: i + 1, log_date: addDays(START, i * 3), block_id: activeBlock(d).id, workout_type: 'gym', finished_at: `${addDays(START, i * 3)}T08:00:00`, sets: [] })),
});

test('check-in: due after 8 weeks and 8 sessions on the same plan', () => {
  const d = trained(on('starter-3'), CHECKIN_SESSIONS);
  assert.equal(checkInDue(d, addDays(START, 55)), false); // 7 weeks 6 days
  assert.equal(checkInDue(d, addDays(START, 56)), true);
  assert.equal(checkInDue(trained(on('starter-3'), CHECKIN_SESSIONS - 1), addDays(START, 70)), false);
  // Later: two weeks quiet. Done: quiet until the next plan.
  const today = addDays(START, 60);
  const later = snoozeCheckIn(d, today);
  assert.equal(checkInDue(later, addDays(today, 13)), false);
  assert.equal(checkInDue(later, addDays(today, 14)), true);
  assert.equal(checkInDue(finishCheckIn(d), addDays(START, 200)), false);
  assert.equal(checkInDue(D.emptyData(content), today), false);
});

test('check-in: a better plan once the person has trained 8 weeks', () => {
  assert.equal(betterRoutine(on('starter-3'), content), 'full-body-3');
  assert.equal(betterRoutine(on('starter-3', { setup: { days: 4 } }), content), 'upper-lower-4');
  assert.equal(betterRoutine(on('starter-2'), content), 'full-body-2');
  assert.equal(betterRoutine(on('ppl-3'), content), 'full-body-3');
  // Already the best fit, or at home: nothing to suggest.
  assert.equal(betterRoutine(on('upper-lower-4'), content), null);
  assert.equal(betterRoutine(on('full-body-3'), content), null);
  assert.equal(betterRoutine(on('home-3'), content), null);
  assert.equal(betterRoutine(D.emptyData(content), content), null);
});

test('check-in: every exercise of the plan, once, in week order', () => {
  const d = on('upper-lower-4');
  const list = checkInExercises(d, content);
  const r = routineById(content, 'upper-lower-4');
  assert.equal(list.length, r.program.reduce((n, s) => n + s.exercises.length, 0));
  assert.equal(list[0].key, 'upper_a');
  assert.equal(list[0].index, 0);
});

test('build goal: one more set on each session\'s first lift', () => {
  const plain = on('upper-lower-4');
  const more = withMainSet(plain);
  for (const [i, s] of activeBlock(plain).sessions.entries()) {
    assert.equal(activeBlock(more).sessions[i].exercises[0].sets, s.exercises[0].sets + 1);
    assert.equal(activeBlock(more).sessions[i].exercises[1].sets, s.exercises[1].sets);
  }
  const a = { goal: 'gain', where: 'gym', days: 4, experience: 'some', job: 'desk' };
  const gain = finishSetup(D.emptyData(content), content, a, '2026-11-13');
  const lose = finishSetup(D.emptyData(content), content, { ...a, goal: 'lose' }, '2026-11-13');
  assert.equal(activeBlock(gain).sessions[0].exercises[0].sets, activeBlock(lose).sessions[0].exercises[0].sets + 1);
  assert.equal(gain.setup.days, 4);
});
