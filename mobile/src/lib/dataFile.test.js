import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import { ImportError, parseDataFile, summarize, toDataFile } from './dataFile.js';
import { content } from './testContent.js';

// The shape the old site's Settings > "Download my data" produces.
const SERVER_EXPORT = {
  format: 'fitness-os-export',
  version: 1,
  exported_at: '2026-11-04T11:51:51Z',
  profile: { id: 1, height_cm: 173, goal_weight_low_kg: 75 },
  exercises: [{ id: 7, name: 'Leg Press', muscle_group: 'Legs', equipment: 'Machine' }],
  body_logs: [{ id: 2, log_date: '2026-10-30', weight_kg: 82 }, { id: 1, log_date: '2026-10-01', weight_kg: 84 }],
  hydration_logs: [],
  workouts: [{ id: 3, log_date: '2026-10-29', workout_type: 'gym', notes: 'Pull', sets: [{ id: 9, workout_id: 3, exercise_id: 7, set_number: 1, reps: 10, weight_kg: 60, rpe: 8 }], checklist_items: [] }],
  meal_logs: [{ id: 1, log_date: '2026-10-29', meal_slot: 'breakfast', completed: true, option_key: 'option_a', drink_key: null }],
  bonus_logs: [],
};

test('imports the old site export, keeping its ids and adding missing exercises', () => {
  const data = parseDataFile(JSON.stringify(SERVER_EXPORT), content);
  assert.equal(data.exercises[0].id, 7);
  assert.ok(data.exercises.length > 1);
  assert.equal(new Set(data.exercises.map((e) => e.id)).size, data.exercises.length);
  assert.deepEqual(data.body_logs.map((b) => b.log_date), ['2026-10-01', '2026-10-30']);
  assert.equal(data.workouts[0].sets[0].exercise_id, 7);
  assert.deepEqual(summarize(data), { weighIns: 2, workouts: 1, sets: 1, meals: 1 });
});

test('a backup made by the app imports back to the same data', () => {
  const data = parseDataFile(JSON.stringify(SERVER_EXPORT), content);
  assert.deepEqual(parseDataFile(toDataFile(data), content), data);
  const empty = emptyData(content);
  assert.deepEqual(parseDataFile(toDataFile(empty), content), empty);
});

test('later fields (moved sessions, notes, badges) survive a backup', () => {
  const data = { ...parseDataFile(JSON.stringify(SERVER_EXPORT), content), session_moves: [{ from: '2026-11-03', to: '2026-11-04', key: 'push' }], exercise_notes: { 'Leg Press': 'Seat 5' }, achievements: { first: '2026-11-04' } };
  assert.deepEqual(parseDataFile(toDataFile(data), content), data);
});

test('rejects files that are not a Fitness OS export', () => {
  assert.throws(() => parseDataFile('not json', content), ImportError);
  assert.throws(() => parseDataFile('{"format":"other"}', content), ImportError);
  assert.throws(() => parseDataFile(JSON.stringify({ ...SERVER_EXPORT, version: 2 }), content), ImportError);
  assert.throws(() => parseDataFile(JSON.stringify({ ...SERVER_EXPORT, workouts: null }), content), ImportError);
});
