// One-window muscle volume (charts step 4, BI-17).
import assert from 'node:assert/strict';
import test from 'node:test';

import { addSet, emptyData, exerciseByName, startWorkout } from './data.js';
import { activePlan } from './plan.js';
import { muscleVolume } from './muscleVolume.js';
import { content } from './testContent.js';

const TODAY = '2026-11-11'; // Wednesday; this week started Sunday 8 Nov

function logged(d, date, name, n, extra = {}) {
  const r = startWorkout(d, { date, sessionKey: null, label: 'x' });
  let out = r.data;
  const id = exerciseByName(out, name).id;
  for (let i = 0; i < n; i += 1) out = addSet(out, r.workoutId, { exerciseId: id, reps: 8, weightKg: 40 });
  if (extra.deload) out = { ...out, workouts: out.workouts.map((w) => (w.id === r.workoutId ? { ...w, is_deload: true } : w)) };
  return out;
}
const run = (d) => muscleVolume(d, activePlan(d, content), TODAY);

test('averages completed weeks since the first workout, this week apart', () => {
  let d = emptyData(content);
  d = logged(d, '2026-10-26', 'Bench Press', 12); // week of 25 Oct
  d = logged(d, '2026-11-02', 'Bench Press', 8); // week of 1 Nov
  d = logged(d, '2026-11-09', 'Bench Press', 4); // this week
  const v = run(d);
  assert.equal(v.ready, true);
  assert.equal(v.weeks, 2); // 18 Oct and 11 Oct were before the first workout
  assert.deepEqual(v.groups.chest, { avg: 10, soFar: 4, band: 'good' });
  assert.equal(v.groups.triceps.avg, 5); // helper: half credit
  assert.equal(v.groups.triceps.band, 'low');
  assert.equal(v.groups.quads.band, 'none');
});

test('recovery weeks are left out, and a first week alone is not ready', () => {
  let d = emptyData(content);
  d = logged(d, '2026-10-19', 'Bench Press', 10);
  d = logged(d, '2026-10-26', 'Bench Press', 4, { deload: true });
  d = logged(d, '2026-11-02', 'Bench Press', 20);
  const v = run(d);
  assert.equal(v.weeks, 2);
  assert.equal(v.skipped, 1);
  assert.equal(v.groups.chest.avg, 15);
  const fresh = run(logged(emptyData(content), '2026-11-09', 'Bench Press', 4));
  assert.equal(fresh.ready, false);
  assert.equal(fresh.groups.chest.soFar, 4);
});

test('a pull-up style move counts once for its group, not per muscle', () => {
  let d = emptyData(content);
  d = logged(d, '2026-11-02', 'Lat Pulldown', 10);
  const v = run(d);
  assert.ok(v.groups.back.avg <= 10, String(v.groups.back.avg));
});

test('stretches count for nothing, and are not unknown', () => {
  let d = emptyData(content);
  d = { ...d, exercises: [...d.exercises, { id: 998, name: 'Quad Stretch', muscle_group: 'Legs', custom: true }] };
  d = logged(d, '2026-11-02', 'Quad Stretch', 4);
  const v = muscleVolume(d, activePlan(d, content), TODAY, (name) => (name === 'Quad Stretch' ? { category: 'stretching', primaryMuscles: ['quadriceps'] } : null));
  assert.equal(v.groups.quads.avg, 0);
  assert.equal(v.unknown, 0);
});
