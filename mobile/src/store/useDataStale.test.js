// Audit UX-1: a workout left open on an earlier day is finished at start,
// so it is not reopened as today's session.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const KEY = 'fitness-os-data-v1';
const base = JSON.parse(readFileSync(new URL('../lib/fixtures/v2-friend.json', import.meta.url), 'utf8'));
const started = Date.now() - 3 * 86400000;
const old = new Date(started).toISOString().slice(0, 10);
const sets = [{ id: 900001, exercise_id: 1, set_number: 1, reps: 8, weight_kg: 40, is_warmup: false }];
const data = { ...base, saved_at: Date.now(), workouts: [...(base.workouts || []), { id: 99999, log_date: old, workout_type: 'gym', started_at: started, finished_at: null, sets, notes: 'Push' }] };
localStorage.clear();
localStorage.setItem(KEY, JSON.stringify(data));
const { useData } = await import('./useData.js');

test('an open workout from an earlier day is finished at start, with its sets kept', async () => {
  await useData.getState().hydrate();
  const s = useData.getState();
  assert.equal(s.activeWorkoutId, null);
  const w = s.data.workouts.find((x) => x.id === 99999);
  assert.ok(w.finished_at && w.auto_closed);
  assert.equal(w.sets.length, 1);
  assert.ok(JSON.parse(localStorage.getItem(KEY)).workouts.find((x) => x.id === 99999).finished_at, 'saved');
});
