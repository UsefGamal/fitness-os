import assert from 'node:assert/strict';
import test from 'node:test';

import { badges, countPrs, newBadges, recordBadges } from './achievements.js';

const exercises = [{ id: 1, name: 'Bench', muscle_group: 'Chest' }];
const w = (id, log_date, weight) => ({ id, log_date, workout_type: 'gym', sets: [{ id, exercise_id: 1, weight_kg: weight, reps: 5 }] });

test('a set that beats every earlier one counts as a PR', () => {
  const data = { exercises, workouts: [w(1, '2026-10-01', 60), w(2, '2026-10-08', 65), w(3, '2026-10-15', 62), w(4, '2026-10-22', 70)], body_logs: [] };
  assert.equal(countPrs(data), 2);
});

test('badges are earned from the data and recorded once', () => {
  const data = { exercises, workouts: [w(1, '2026-10-01', 60), w(2, '2026-10-08', 65)], body_logs: [] };
  const all = badges(data, '2026-11-04');
  assert.equal(all.find((b) => b.id === 'first').earned, true);
  assert.equal(all.find((b) => b.id === 'pr1').earned, true);
  assert.equal(all.find((b) => b.id === 'w10').fraction, 0.2);
  const fresh = newBadges(data, '2026-11-04').map((b) => b.id);
  assert.ok(fresh.includes('first'));
  const kept = recordBadges(data, fresh, '2026-11-04');
  assert.deepEqual(newBadges(kept, '2026-11-04'), []);
  assert.equal(badges(kept, '2026-11-04').find((b) => b.id === 'first').date, '2026-11-04');
});
