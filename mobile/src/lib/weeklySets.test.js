// Weekly sets per muscle (E4-S19).
import assert from 'node:assert/strict';
import test from 'node:test';

import { addSet, emptyData, exerciseByName, startWorkout } from './data.js';
import { activePlan } from './plan.js';
import { band, doneThisWeek, GUIDE, muscleRows, plannedThisWeek } from './weeklySets.js';
import { content } from './testContent.js';

const TODAY = '2026-11-11'; // Wednesday; the week started Sunday 8 Nov

function logged(d, date, name, n, extra = {}) {
  const r = startWorkout(d, { date, sessionKey: null, label: 'x' });
  let out = r.data;
  const id = exerciseByName(out, name).id;
  for (let i = 0; i < n; i += 1) out = addSet(out, r.workoutId, { exerciseId: id, reps: 8, weightKg: 40 });
  if (extra.warmup) out = { ...out, workouts: out.workouts.map((w) => (w.id === r.workoutId ? { ...w, sets: w.sets.map((s) => ({ ...s, is_warmup: true })) } : w)) };
  return out;
}

test('a set counts 1 for the main muscle and half for helpers', () => {
  let d = emptyData(content);
  d = logged(d, '2026-11-09', 'Bench Press', 4);
  const { muscles, unknown } = doneThisWeek(d, activePlan(d, content), TODAY);
  assert.deepEqual(muscles, { chest: 4, 'front delts': 2, triceps: 2 });
  assert.equal(unknown, 0);
});

test('only this week counts, and warm-ups never do', () => {
  let d = emptyData(content);
  d = logged(d, '2026-11-07', 'Bench Press', 4); // last Saturday
  d = logged(d, '2026-11-12', 'Bench Press', 4); // tomorrow
  d = logged(d, '2026-11-10', 'Lat Pulldown', 3, { warmup: true });
  assert.deepEqual(doneThisWeek(d, activePlan(d, content), TODAY).muscles, {});
});

test('an exercise without tags counts as unknown unless the catalogue knows it', () => {
  let d = emptyData(content);
  d = { ...d, exercises: [...d.exercises, { id: 999, name: 'Mystery Move', muscle_group: 'Other', custom: true }] };
  d = logged(d, '2026-11-09', 'Mystery Move', 2);
  const T = activePlan(d, content);
  assert.equal(doneThisWeek(d, T, TODAY).unknown, 2);
  const entry = { name: 'Mystery Move', primary: ['calves'], secondary: [] };
  assert.deepEqual(doneThisWeek(d, T, TODAY, (n) => (n === 'Mystery Move' ? entry : null)).muscles, { calves: 2 });
});

test("the plan's week adds up every session", () => {
  const d = emptyData(content);
  const T = activePlan(d, content);
  const { muscles, unknown } = plannedThisWeek(d, T, TODAY);
  assert.equal(unknown, 0, 'every plan exercise is hand-checked');
  const total = T.trainer_plan.schedule
    .filter((e) => e.session !== 'rest')
    .flatMap((e) => T.program.find((p) => p.key === e.session).exercises)
    .reduce((n, ex) => n + ex.sets, 0);
  const mains = Object.values(muscles).reduce((a, b) => a + b, 0);
  assert.ok(mains >= total, 'each set lands on at least one main muscle');
});

test('the 10-20 guide', () => {
  assert.equal(band(0), 'none');
  assert.equal(band(GUIDE.low - 0.5), 'low');
  assert.equal(band(GUIDE.low), 'good');
  assert.equal(band(GUIDE.high), 'good');
  assert.equal(band(GUIDE.high + 1), 'high');
});

test('rows list the ~15 muscles in body order, quiet ones only when hit', () => {
  const rows = muscleRows({ chest: 4.25 }, { chest: 12, neck: 0 });
  assert.equal(rows[0].key, 'chest');
  assert.deepEqual(rows[0], { key: 'chest', label: 'Chest', group: 'Chest', done: 4.5, planned: 12, band: 'good', doneBand: 'low' });
  assert.ok(!rows.some((r) => r.key === 'neck'));
  assert.ok(rows.length >= 15);
  assert.ok(muscleRows({ neck: 2 }, {}).some((r) => r.key === 'neck'));
});
