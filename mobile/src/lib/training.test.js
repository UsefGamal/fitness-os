import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activeMs, clock, defaultTraining, intervalSteps, INTERVAL_PRESETS, normalizeIntervals, pauseWorkout, restFor,
  restoreSet, resumeWorkout, setTraining, stepAt, targetProgress, totalSeconds, trainingSettings,
} from './training.js';

test('settings fill in defaults and keep changes', () => {
  assert.deepEqual(trainingSettings({ settings: {} }), defaultTraining());
  const d = setTraining({ settings: { notifications: true } }, { volume: 'high' });
  assert.equal(trainingSettings(d).volume, 'high');
  assert.equal(trainingSettings(d).auto_rest, true);
  assert.equal(d.settings.notifications, true);
});

test('rest: one-off override, then the plan, then big or small lift default', () => {
  const s = defaultTraining();
  assert.equal(restFor({ rest_sec: 150 }, s), 150);
  assert.equal(restFor({}, s, { mechanic: 'compound' }), 120);
  assert.equal(restFor({}, s, { mechanic: 'isolation' }), 75);
  assert.equal(restFor({}, s), 120);
  assert.equal(restFor({ rest_sec: 150 }, s, { override: 0 }), 0);
  assert.equal(restFor({ rest_sec: 150 }, s, { override: 45 }), 45);
});

test('clock formats seconds', () => {
  assert.equal(clock(90), '1:30');
  assert.equal(clock(5), '0:05');
  assert.equal(clock(-3), '0:00');
  assert.equal(clock(720), '12:00');
});

test('pauses are left out of workout time', () => {
  let d = { workouts: [{ id: 1, started_at: 0, sets: [] }] };
  d = pauseWorkout(d, 1, 10 * 60000);
  assert.equal(activeMs(d.workouts[0], 15 * 60000), 10 * 60000);
  d = resumeWorkout(d, 1, 15 * 60000);
  assert.equal(activeMs(d.workouts[0], 20 * 60000), 15 * 60000);
  assert.equal(d.workouts[0].paused_at, null);
  assert.equal(pauseWorkout(pauseWorkout(d, 1, 1), 1, 2).workouts[0].paused_at, 1);
});

test('undo puts a deleted set back and renumbers', () => {
  const d = { workouts: [{ id: 1, sets: [{ id: 1, exercise_id: 7, set_number: 1 }, { id: 3, exercise_id: 7, set_number: 2 }] }] };
  const back = restoreSet(d, 1, { id: 2, exercise_id: 7, set_number: 2 });
  assert.deepEqual(back.workouts[0].sets.map((s) => [s.id, s.set_number]), [[1, 1], [2, 2], [3, 3]]);
});

test('target length progress', () => {
  assert.equal(targetProgress(1000, 0), null);
  assert.deepEqual(targetProgress(30 * 60000, 60), { fraction: 0.5, over: false });
  assert.equal(targetProgress(61 * 60000, 60).over, true);
});

test('interval steps: warm-up, rounds without a trailing rest, set rests, cool-down', () => {
  const steps = intervalSteps({ work: 20, rest: 10, rounds: 3, sets: 2, setRest: 60, warmup: 30, cooldown: 30 });
  assert.deepEqual(steps.map((s) => s.kind), [
    'warmup', 'work', 'rest', 'work', 'rest', 'work', 'setrest', 'work', 'rest', 'work', 'rest', 'work', 'cooldown',
  ]);
  assert.equal(totalSeconds(steps), 30 + 2 * (3 * 20 + 2 * 10) + 60 + 30);
});

test('Tabata preset is 8 x 20/10 with a warm-up and cool-down', () => {
  const tabata = INTERVAL_PRESETS.find((p) => p.key === 'tabata');
  const steps = intervalSteps(tabata);
  assert.equal(steps.filter((s) => s.kind === 'work').length, 8);
  assert.equal(steps.filter((s) => s.kind === 'rest').length, 7);
});

test('custom values are clamped to safe numbers', () => {
  const c = normalizeIntervals({ work: 1, rest: -5, rounds: 999, sets: 'x', setRest: null });
  assert.deepEqual([c.work, c.rest, c.rounds, c.sets, c.setRest], [5, 0, 50, 1, 0]);
});

test('stepAt finds the running step and time left', () => {
  const steps = intervalSteps({ work: 20, rest: 10, rounds: 2 });
  assert.deepEqual(stepAt(steps, 0), { index: 0, left: 20 });
  assert.deepEqual(stepAt(steps, 25), { index: 1, left: 5 });
  assert.deepEqual(stepAt(steps, 30), { index: 2, left: 20 });
  assert.deepEqual(stepAt(steps, 50), { done: true });
});

test('a finished workout saves active minutes, capped at three hours (TEST-1)', async () => {
  const { finishedMinutes, MAX_WORKOUT_MIN, ranLong } = await import('./training.js');
  const MIN = 60000;
  const t0 = 1_800_000_000_000;
  assert.equal(finishedMinutes({ started_at: t0 }, t0 + 55 * MIN), 55);
  assert.equal(finishedMinutes({ started_at: t0, paused_ms: 20 * MIN }, t0 + 55 * MIN), 35);
  assert.equal(finishedMinutes({ started_at: t0, paused_ms: 5 * MIN, paused_at: t0 + 40 * MIN }, t0 + 55 * MIN), 35, 'an open pause ends at the finish');
  assert.equal(finishedMinutes({ started_at: t0 }, t0 + 10000), 1);
  assert.equal(finishedMinutes({ started_at: t0 }, t0 + 9 * 60 * MIN), MAX_WORKOUT_MIN);
  assert.equal(ranLong({ started_at: t0, finished_at: t0 + 9 * 60 * MIN }), true);
  assert.equal(ranLong({ started_at: t0, finished_at: t0 + 9 * 60 * MIN, paused_ms: 7 * 60 * MIN }), false);
  assert.equal(ranLong({ started_at: t0, finished_at: t0 + 170 * MIN }), false);
  assert.equal(ranLong({ started_at: t0 }), false);
  assert.equal(ranLong({ finished_at: t0 }), false);
});

test('the screen stays on for 20 minutes after the last tap, and while a rest timer runs (TEST-1)', async () => {
  const { AWAKE_IDLE_MS, shouldStayAwake } = await import('./training.js');
  const now = 1_800_000_000_000;
  assert.equal(shouldStayAwake(now - 60000, false, now), true);
  assert.equal(shouldStayAwake(now - AWAKE_IDLE_MS + 1, false, now), true);
  assert.equal(shouldStayAwake(now - AWAKE_IDLE_MS, false, now), false);
  assert.equal(shouldStayAwake(now - 3 * AWAKE_IDLE_MS, true, now), true);
  assert.equal(shouldStayAwake(null, false, now), false);
  assert.equal(shouldStayAwake(null, true, now), true);
});
