import assert from 'node:assert/strict';
import test from 'node:test';

import { firstForMuscles, warmupPlan } from './warmup.js';

test('a barbell lift gets the plate ramp; nothing at or below the bar', () => {
  const r = warmupPlan({ workKg: 100, barbell: true, barKg: 20 });
  assert.deepEqual(r.map((w) => w.kg), [40, 60, 80]);
  assert.ok(r.every((w) => w.kg < 100 && w.reps > 0));
  assert.deepEqual(warmupPlan({ workKg: 20, barbell: true, barKg: 20 }), []);
});

test('a dumbbell or machine lift gets two lighter sets on its own step', () => {
  assert.deepEqual(warmupPlan({ workKg: 20, step: 2 }), [{ kg: 10, reps: 10 }, { kg: 16, reps: 5 }]);
  assert.deepEqual(warmupPlan({ workKg: 50, step: 2.5 }), [{ kg: 25, reps: 10 }, { kg: 37.5, reps: 5 }]);
  assert.deepEqual(warmupPlan({ workKg: 4, step: 2 }), [{ kg: 2, reps: 10 }], 'a doubled-up step is dropped');
  assert.deepEqual(warmupPlan({ workKg: 0 }), [], 'no weight yet: nothing');
  assert.deepEqual(warmupPlan({ workKg: 1, step: 2.5 }), [], 'too light to warm up below');
});

test('warm-ups only for the first lift of a muscle today', () => {
  const chest = { main: ['chest'], helpers: ['triceps', 'front_delts'] };
  const incline = { main: ['chest'], helpers: ['front_delts'] };
  const pushdown = { main: ['triceps'], helpers: [] };
  const row = { main: ['lats'], helpers: ['biceps'] };
  const t = [chest, incline, pushdown, row];
  assert.deepEqual(t.map((_, i) => firstForMuscles(t, i)), [true, false, false, true]);
  assert.equal(firstForMuscles([null, null], 0), true);
  assert.equal(firstForMuscles([null, null], 1), false, 'unknown muscles: only the first exercise');
  assert.equal(firstForMuscles([null, row], 1), true, 'an unknown earlier lift warms nothing');
});
