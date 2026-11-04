import assert from 'node:assert/strict';
import test from 'node:test';

import * as D from './data.js';
import { healthWorkouts, mergeWeighIns } from './health.js';
import { content } from './testContent.js';

const at = (iso, h) => new Date(`${iso}T${String(h).padStart(2, '0')}:00:00`).getTime();

test('weigh-ins fill dates the app has none for, last reading of the day wins', () => {
  let data = D.logBody(D.emptyData(content), { log_date: '2026-11-02', weight_kg: 90 });
  const r = mergeWeighIns(data, [
    { time: at('2026-11-01', 7), kg: 91.24 },
    { time: at('2026-11-01', 21), kg: 91.66 },
    { time: at('2026-11-02', 7), kg: 89 }, // the app's own entry wins
    { time: at('2026-11-03', 7), kg: 5 }, // nonsense reading
  ]);
  data = r.data;
  assert.equal(r.added, 1);
  assert.deepEqual(data.body_logs.map((b) => [b.log_date, b.weight_kg]), [['2026-11-01', 91.7], ['2026-11-02', 90]]);
});

test('workouts become exercise sessions with their real times', () => {
  let data = D.emptyData(content);
  const s = D.startWorkout(data, { date: '2026-11-02', sessionKey: 'upper', label: 'Upper' });
  data = D.addSet(s.data, s.workoutId, { exerciseId: 1, reps: 10, weightKg: 40 });
  data = D.editWorkout(data, s.workoutId, { started_at: at('2026-11-02', 7) });
  data = D.finishWorkout(data, s.workoutId, { now: at('2026-11-02', 8) });
  data = D.logSession(data, { date: '2026-11-03', type: 'padel', label: 'Padel', durationMin: 90, now: at('2026-11-03', 20) });
  const [gym, padel] = healthWorkouts(data);
  assert.deepEqual([gym.start, gym.end, gym.kind, gym.title, gym.notes], [at('2026-11-02', 7), at('2026-11-02', 8), 'strength', 'Upper', '1 set']);
  // A logged session has no start time: it starts at the session time and lasts its 90 minutes.
  assert.equal(padel.kind, 'other');
  assert.equal(padel.start, at('2026-11-03', 7));
  assert.equal(padel.end - padel.start, 90 * 60000);
});

test('an imported workout with only a date and a duration starts at the session time', () => {
  const data = { ...D.emptyData(content), workouts: [{ id: 7, log_date: '2026-10-01', workout_type: 'gym', notes: 'Pull', duration_min: 50, sets: [{ id: 1 }], checklist_items: [], started_at: null, finished_at: null }] };
  const [w] = healthWorkouts(data, '07:00');
  assert.equal(w.start, at('2026-10-01', 7));
  assert.equal(w.end - w.start, 50 * 60000);
});
