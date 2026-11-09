import assert from 'node:assert/strict';
import test from 'node:test';

import { e1rmSeries, lastTrained, monthLabels, recoveryState, setsByGroup, totalVolume, trackedExercises, volumeLevel, weekStreaks, yearGrid } from './insights.js';

const exercises = [{ id: 1, name: 'Bench', muscle_group: 'Chest' }, { id: 2, name: 'Squat', muscle_group: 'Legs' }];
const w = (id, log_date, sets) => ({ id, log_date, workout_type: 'gym', sets: sets.map(([exercise_id, weight_kg, reps], i) => ({ id: id * 10 + i, exercise_id, weight_kg, reps })) });

test('sets per group count only the last 7 days', () => {
  const data = { exercises, workouts: [w(1, '2026-10-20', [[1, 60, 8]]), w(2, '2026-11-01', [[1, 60, 8], [1, 60, 8], [2, 100, 5]])] };
  const s = setsByGroup(data, '2026-11-04');
  assert.equal(s.Chest, 2);
  assert.equal(s.Legs, 1);
  assert.equal(s.Back, 0);
  assert.deepEqual([0, 3, 8, 15].map(volumeLevel), [0, 1, 2, 3]);
});

test('recovery: under 48 h recovering, a week or more untrained', () => {
  const data = { exercises, workouts: [w(1, '2026-11-03', [[1, 60, 8]]), w(2, '2026-10-25', [[2, 100, 5]])] };
  assert.equal(lastTrained(data, '2026-11-04').Chest, '2026-11-03');
  const r = recoveryState(data, '2026-11-04');
  assert.equal(r.Chest, 'recovering');
  assert.equal(r.Legs, 'untrained');
  assert.equal(r.Back, 'untrained');
  assert.equal(recoveryState(data, '2026-11-06').Chest, 'ready');
});

test('year grid is Sunday-start weeks ending this week', () => {
  const data = { exercises, workouts: [w(1, '2026-11-02', [])] };
  const g = yearGrid(data, '2026-11-04', 3);
  assert.equal(g.length, 3);
  assert.equal(g[2][0].date, '2026-11-01'); // Sunday
  assert.equal(g[2][1].count, 1);
  assert.equal(g[2][6].future, true);
  assert.ok(monthLabels(g).length >= 1);
});

test('week streaks: current run and the longest', () => {
  const data = { exercises, workouts: ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-27', '2026-09-01'].map((d, i) => w(i + 1, d, [])) };
  assert.deepEqual(weekStreaks(data, '2026-11-04'), { current: 4, longest: 4 });
  assert.deepEqual(weekStreaks(data, '2026-11-12'), { current: 0, longest: 4 });
  assert.deepEqual(weekStreaks({ workouts: [] }, '2026-11-04'), { current: 0, longest: 0 });
});

test('e1RM series keeps the best set per day', () => {
  const data = { exercises, workouts: [w(1, '2026-11-01', [[1, 60, 10], [1, 70, 1]]), w(2, '2026-10-01', [[1, 50, 5]])] };
  assert.deepEqual(e1rmSeries(data, 1), [{ date: '2026-10-01', value: 58.3 }, { date: '2026-11-01', value: 80 }]);
  assert.deepEqual(trackedExercises(data).map((e) => [e.name, e.sessions]), [['Bench', 2]]);
  assert.equal(totalVolume(data), 600 + 70 + 250);
});

test('a planned day lights the groups of its exercises', async () => {
  const { dayGroups } = await import('./insights.js');
  assert.deepEqual([...dayGroups({ exercises }, [{ name: 'Bench' }, { name: 'Unknown' }])], ['Chest']);
});

test('warm-ups stay out of group sets, recovery, volume and the e1RM chart (F-00)', () => {
  const d = { exercises: [{ id: 1, name: 'Bench Press', muscle_group: 'Chest' }], body_logs: [], workouts: [
    { id: 1, log_date: '2026-11-08', workout_type: 'gym', sets: [{ id: 1, exercise_id: 1, reps: 5, weight_kg: 40, is_warmup: true }] },
  ] };
  assert.equal(setsByGroup(d, '2026-11-09').Chest, 0);
  assert.equal(lastTrained(d, '2026-11-09').Chest, null);
  assert.equal(totalVolume(d), 0);
  assert.deepEqual(e1rmSeries(d, 1), []);
});
