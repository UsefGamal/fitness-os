import assert from 'node:assert/strict';
import test from 'node:test';

import { DONE_GRACE_MS, shadeLines, syncFromShade, timerToRestore, timerToSave } from './restTimer.js';

const now = 1_000_000;
const running = { endsAt: now + 60_000, total: 90, label: 'Squat', pausedLeft: null };

test('coming back with the shade empty keeps the rest going and puts it back in the shade', () => {
  assert.deepEqual(syncFromShade(running, { endsAt: 0, label: '' }, now), { patch: null, reshade: true });
  // An old APK with no skipped field behaves the same.
  assert.deepEqual(syncFromShade(running, { endsAt: 0 }, now), { patch: null, reshade: true });
});

test('Skip in the shade ends the rest in the app too', () => {
  assert.deepEqual(syncFromShade(running, { endsAt: 0, skipped: true }, now), { patch: { endsAt: null, pausedLeft: null }, reshade: false });
  assert.deepEqual(syncFromShade({ ...running, pausedLeft: 20_000 }, { endsAt: 0, skipped: true }, now).patch, { endsAt: null, pausedLeft: null });
});

test('the shade time wins while it is running (+15s pressed in the shade)', () => {
  const r = syncFromShade(running, { endsAt: now + 75_000, label: 'Squat' }, now);
  assert.deepEqual(r, { patch: { endsAt: now + 75_000, pausedLeft: null, label: 'Squat' }, reshade: false });
});

test('after a restart the shade timer comes back with a full bar', () => {
  const r = syncFromShade({ endsAt: null, total: 0, label: '', pausedLeft: null }, { endsAt: now + 40_500, label: 'Row' }, now);
  assert.deepEqual(r.patch, { endsAt: now + 40_500, pausedLeft: null, label: 'Row', total: 41 });
});

test('Pause and Resume in the shade show in the app', () => {
  const paused = syncFromShade(running, { endsAt: running.endsAt, pausedLeft: 42_000, label: 'Squat' }, now);
  assert.deepEqual(paused, { patch: { endsAt: running.endsAt, pausedLeft: 42_000, label: 'Squat' }, reshade: false });
  const resumed = syncFromShade({ ...running, pausedLeft: 42_000 }, { endsAt: now + 42_000, pausedLeft: 0, label: 'Squat' }, now);
  assert.deepEqual(resumed.patch, { endsAt: now + 42_000, pausedLeft: null, label: 'Squat' });
});

test('a rest paused in the app goes back to the shade if the shade lost it', () => {
  assert.deepEqual(syncFromShade({ ...running, pausedLeft: 30_000 }, { endsAt: 0 }, now), { patch: null, reshade: true });
});

test('a finished rest stays on "Rest done"', () => {
  assert.deepEqual(syncFromShade({ ...running, endsAt: now - 1000 }, { endsAt: 0 }, now), { patch: null, reshade: false });
  assert.deepEqual(syncFromShade({ ...running, endsAt: null }, { endsAt: 0 }, now), { patch: null, reshade: false });
});

test('the timer is kept across a close and brought back', () => {
  const saved = JSON.stringify(timerToSave(running));
  assert.deepEqual(timerToRestore(saved, now + 10_000), running);
  assert.equal(timerToSave({ endsAt: null, pausedLeft: null }), null);
});

test('a paused rest comes back paused with the same time left', () => {
  const saved = JSON.stringify(timerToSave({ ...running, pausedLeft: 25_000 }));
  assert.equal(timerToRestore(saved, now + 3_600_000).pausedLeft, 25_000);
});

test('a rest that ended a while ago is not brought back; one that just ended is', () => {
  const saved = JSON.stringify(timerToSave(running));
  assert.equal(timerToRestore(saved, running.endsAt + DONE_GRACE_MS + 1), null);
  assert.equal(timerToRestore(saved, running.endsAt + 5_000).endsAt, running.endsAt);
});

test('junk in storage is ignored', () => {
  for (const raw of [null, '', 'nope', '{', '42', 'null', '{"endsAt":"soon"}']) assert.equal(timerToRestore(raw, now), null);
  assert.equal(timerToRestore(JSON.stringify({ endsAt: now + 1000, label: 'x'.repeat(500) }), now).label.length, 200);
});

test('the notification lines name the next set and the workout so far', () => {
  assert.deepEqual(shadeLines({ setNo: 3, setsPlanned: 4, weightKg: 60, reps: 8, workout: 'Lower A', done: 7, planned: 18 }),
    { detail: 'Set 3 of 4 · 60 kg × 8', progress: 'Lower A · 7/18 sets' });
  assert.deepEqual(shadeLines({ setNo: 1, setsPlanned: 3, targetReps: '8-10', workout: 'Push' }), { detail: 'Set 1 of 3 · 8-10 reps', progress: 'Push' });
  assert.equal(shadeLines({ setNo: 2, weightKg: 22.5, reps: 12 }).detail, 'Set 2 · 22.5 kg × 12');
  assert.deepEqual(shadeLines(), { detail: '', progress: '' });
});

test('shadeLines: the warm-up ramp comes first before a barbell lift', () => {
  const lines = shadeLines({ setNo: 1, setsPlanned: 3, weightKg: 60, reps: 8, workout: 'Lower A', warmup: [{ kg: 20, reps: 8 }, { kg: 40, reps: 5 }, { kg: 50, reps: 3 }] });
  assert.equal(lines.detail, 'Warm up: 20 kg × 8, 40 × 5, 50 × 3 · Set 1 of 3 · 60 kg × 8');
  assert.equal(shadeLines({ setNo: 2, warmup: [] }).detail, 'Set 2');
});
