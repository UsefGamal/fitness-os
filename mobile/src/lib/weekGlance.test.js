import assert from 'node:assert/strict';
import test from 'node:test';

import { weekGlance } from './weekGlance.js';

test('weekGlance: distinct days this week and work sets, warm-ups out', () => {
  const s = (extra = {}) => ({ exercise_id: 1, reps: 8, weight_kg: 40, ...extra });
  const data = { profile: {}, workouts: [
    { log_date: '2026-11-16', sets: [s(), s(), s({ is_warmup: true })] },
    { log_date: '2026-11-16', sets: [s()] }, // same day
    { log_date: '2026-11-18', sets: [], finished_at: 1 }, // a walk, no sets
    { log_date: '2026-11-17', sets: [] }, // opened, nothing done
    { log_date: '2026-11-14', sets: [s()] }, // last week
    { log_date: '2026-11-20', sets: [s()] }, // tomorrow
  ] };
  const g = weekGlance(data, '2026-11-19');
  assert.deepEqual([g.days, g.sets, [...g.done].sort()], [2, 3, ['2026-11-16', '2026-11-18']]);
});
