// Readiness and data health (charts step 5).
import assert from 'node:assert/strict';
import test from 'node:test';

import { addSet, emptyData, exerciseByName, startWorkout } from './data.js';
import { addDays } from './dates.js';
import { dataHealth, readiness } from './dataHealth.js';
import { activePlan } from './plan.js';
import { content } from './testContent.js';

const TODAY = '2026-11-19';
const SLOTS = content.nutrition.meal_slots;
const NOW = Date.parse('2026-11-19T12:00:00Z');

function lift(d, date, kg, reps = 8) {
  const r = startWorkout(d, { date, sessionKey: null, label: 'x' });
  return addSet(r.data, r.workoutId, { exerciseId: exerciseByName(r.data, 'Bench Press').id, reps, weightKg: kg });
}

test('readiness: nothing unlocked on a fresh install, pace needs 8', () => {
  const d = emptyData(content);
  const r = readiness(d, activePlan(d, content), SLOTS, TODAY);
  assert.deepEqual(r.map((x) => x.key), ['pace', 'weekly', 'lifts', 'muscles', 'burn']);
  assert.ok(r.every((x) => !x.done));
  assert.equal(r[0].need, 8);
});

test('readiness: weigh-ins and two lifts a week apart unlock pace, weekly, lifts', () => {
  let d = emptyData(content);
  d = { ...d, body_logs: Array.from({ length: 20 }, (_, i) => ({ log_date: addDays(TODAY, -19 + i), weight_kg: 90 - i * 0.05 })) };
  d = lift(d, addDays(TODAY, -10), 60);
  d = lift(d, addDays(TODAY, -2), 62.5);
  const r = Object.fromEntries(readiness(d, activePlan(d, content), SLOTS, TODAY).map((x) => [x.key, x.done]));
  assert.deepEqual([r.pace, r.weekly, r.lifts, r.muscles], [true, true, true, true]);
  assert.equal(r.burn, false);
  const hidden = readiness({ ...d, safety: { hide_kcal: true } }, activePlan(d, content), SLOTS, TODAY);
  assert.ok(!hidden.some((x) => x.key === 'burn'));
});

test('dataHealth: counts, suspect sets, watch and backup age', () => {
  let d = emptyData(content);
  d = lift(d, addDays(TODAY, -3), 60, 80); // 80 reps: suspect
  d = { ...d, body_logs: [{ log_date: TODAY, weight_kg: 90 }], health_daily: { [addDays(TODAY, -1)]: { steps: 5000, active_kcal: 300 } }, settings: { ...d.settings, last_backup_at: NOW - 3 * 86400000 } };
  const h = Object.fromEntries(dataHealth(d, activePlan(d, content), SLOTS, TODAY, NOW).map((x) => [x.key, x]));
  assert.deepEqual([h.weighins.value, h.weighins.ok], [1, false]);
  assert.deepEqual([h.meals.value, h.meals.ok], [0, false]);
  assert.deepEqual([h.watch.value, h.watch.n], [1, 60]);
  assert.deepEqual([h.suspect.value, h.suspect.ok], [1, false]);
  assert.equal(h.unknown.ok, true);
  assert.deepEqual([h.backup.value, h.backup.ok], [3, true]);
  const never = dataHealth(emptyData(content), activePlan(d, content), SLOTS, TODAY, NOW);
  assert.equal(never.find((x) => x.key === 'backup').value, null);
  assert.ok(!never.some((x) => x.key === 'watch'));
});
