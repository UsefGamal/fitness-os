import assert from 'node:assert/strict';
import test from 'node:test';

import { awayDays, comeback, comebackTarget, hideBack, showBack, skipToday, stillTime } from './comeback.js';
import { addDays } from './dates.js';
import { withoutRecovery } from './recovery.js';

const TODAY = '2026-11-20';
const gym = (log_date, extra = {}) => ({ id: log_date.length + Math.random(), log_date, workout_type: 'gym', finished_at: `${log_date}T08:00:00`, sets: [], ...extra });
const ago = (n, extra) => ({ workouts: [gym(addDays(TODAY, -n), extra)], settings: {} });

test('levels at every edge of the table', () => {
  const at = (n) => comeback(ago(n), TODAY)?.level ?? null;
  assert.equal(at(0), null);
  assert.equal(at(3), null);
  assert.equal(at(4), 'short');
  assert.equal(at(13), 'short');
  assert.equal(at(14), 'easy90');
  assert.equal(at(27), 'easy90');
  assert.equal(at(28), 'easy80');
  assert.equal(at(62), 'easy80');
  assert.equal(at(63), 'fresh');
  assert.deepEqual(comeback(ago(20), TODAY), { days: 20, level: 'easy90' });
});

test('never trained is not "back"; any workout type counts', () => {
  assert.equal(awayDays({ workouts: [] }, TODAY), null);
  assert.equal(comeback({ workouts: [] }, TODAY), null);
  const walk = { workouts: [gym(addDays(TODAY, -30)), { id: 9, log_date: addDays(TODAY, -2), workout_type: 'cardio', sets: [] }] };
  assert.equal(comeback(walk, TODAY), null);
});

test('it lasts until the first session back is finished', () => {
  const data = ago(20);
  const running = { ...data, workouts: [...data.workouts, gym(TODAY, { finished_at: null })] };
  assert.equal(comeback(running, TODAY).level, 'easy90');
  const done = { ...data, workouts: [...data.workouts, gym(TODAY, { easy: true })] };
  assert.equal(comeback(done, TODAY), null);
  assert.equal(comeback(done, addDays(TODAY, 2)), null);
});

test('the easy session is left out of progression, like recovery weeks', () => {
  const workouts = [{ id: 1, is_deload: true }, { id: 2, easy: true }, { id: 3 }];
  const history = [{ workoutId: 1 }, { workoutId: 2 }, { workoutId: 3 }];
  assert.deepEqual(withoutRecovery(history, workouts), [{ workoutId: 3 }]);
});

test('comebackTarget: lighter loads at the bottom of the range', () => {
  const sessions = [[{ weight_kg: 60, reps: 10 }, { weight_kg: 60, reps: 9 }]];
  const add = { weightKg: 62.5, reps: 8, kind: 'add', reason: 'add' };
  const e90 = comebackTarget(add, 'easy90', { planReps: '8-12', sessions, step: 2.5 });
  assert.deepEqual([e90.weightKg, e90.reps, e90.kind], [55, 8, 'easy']); // 54 rounds to 55
  assert.match(e90.reason, /^Welcome back: 55 kg today, a little lighter than last time\.$/);
  assert.equal(comebackTarget(add, 'easy80', { planReps: '8-12', sessions, step: 2.5 }).weightKg, 47.5);
  // A few days off: last time's weight, never "add".
  const short = comebackTarget(add, 'short', { planReps: '8-12', sessions });
  assert.deepEqual([short.weightKg, short.kind], [60, 'repeat']);
  const repeat = { weightKg: 60, reps: 10, kind: 'repeat', reason: 'r' };
  assert.equal(comebackTarget(repeat, 'short', { planReps: '8-12', sessions }), repeat);
  // 8+ weeks: no prefilled weight.
  const fresh = comebackTarget(add, 'fresh', { planReps: '8-12', sessions });
  assert.deepEqual([fresh.weightKg, fresh.reps, fresh.kind], [null, 8, 'fresh']);
  // No level, or a first time: unchanged.
  assert.equal(comebackTarget(add, null, { sessions }), add);
  const first = { weightKg: null, reps: 8, kind: 'start' };
  assert.equal(comebackTarget(first, 'easy90', { planReps: '8-12', sessions: [] }), first);
  assert.ok(!/missed|failed|behind|should/i.test([e90, short, fresh].map((t) => t.reason).join(' ')));
});

test('the welcome-back card hides for the day only', () => {
  const data = ago(20);
  assert.equal(showBack(data, TODAY), true);
  const hidden = hideBack(data, TODAY);
  assert.equal(showBack(hidden, TODAY), false);
  assert.equal(comeback(hidden, TODAY).level, 'easy90'); // the lighter loads still apply
  assert.equal(showBack(hidden, addDays(TODAY, 1)), true);
});

test('still time today: two hours after the session time, around the edges', () => {
  const data = ago(1);
  const base = { data, today: TODAY, sessionTime: '07:00', scheduled: 'upper', moveTo: addDays(TODAY, 1) };
  assert.equal(stillTime({ ...base, nowMinutes: 9 * 60 }), null); // exactly 2 h
  assert.deepEqual(stillTime({ ...base, nowMinutes: 9 * 60 + 1 }), { moveTo: addDays(TODAY, 1) });
  assert.equal(stillTime({ ...base, scheduled: 'rest', nowMinutes: 20 * 60 }), null);
  assert.equal(stillTime({ ...base, recovery: true, nowMinutes: 20 * 60 }), null);
  // A late session: the 2 hours would pass midnight, so it never asks.
  assert.equal(stillTime({ ...base, sessionTime: '22:30', nowMinutes: 23 * 60 + 59 }), null);
  assert.equal(stillTime({ ...base, nowMinutes: 0 }), null);
  // Trained (or training) today, skipped today, or back after a gap: no question.
  assert.equal(stillTime({ ...base, data: { ...data, workouts: [...data.workouts, gym(TODAY, { finished_at: null })] }, nowMinutes: 20 * 60 }), null);
  assert.equal(stillTime({ ...base, data: skipToday(data, TODAY), nowMinutes: 20 * 60 }), null);
  assert.ok(stillTime({ ...base, data: skipToday(data, addDays(TODAY, -1)), nowMinutes: 20 * 60 }));
  assert.equal(stillTime({ ...base, data: ago(20), nowMinutes: 20 * 60 }), null);
});
