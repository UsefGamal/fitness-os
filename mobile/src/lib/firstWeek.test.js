import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FIRST_WEEK_DAYS, firstWeekSteps, hideFirstWeek, markWidgetDone, showFirstWeek, weighStep } from './firstWeek.js';

const fresh = (extra = {}) => ({
  workouts: [], meal_logs: [], body_logs: [], settings: {}, safety: {},
  goals: [{ direction: 'lose' }], setup: { done_on: '2026-11-15' }, ...extra,
});
const keys = (steps) => steps.map((s) => s.key);
const doneOf = (steps) => Object.fromEntries(steps.map((s) => [s.key, s.done]));

test('a new phone: five steps, none done, card shows', () => {
  const d = fresh();
  const steps = firstWeekSteps(d);
  assert.deepEqual(keys(steps), ['workout', 'meal', 'weigh', 'backup', 'widget']);
  assert.ok(steps.every((s) => !s.done));
  assert.equal(showFirstWeek(d, '2026-11-15', steps), true);
});

test('each step ticks itself from the data', () => {
  const d = fresh({
    workouts: [{ id: 1, finished_at: '2026-11-15T07:40:00' }],
    meal_logs: [{ log_date: '2026-11-15', meal_slot: 'breakfast', completed: true }],
    body_logs: [{ log_date: '2026-11-15', weight_kg: 90 }],
    settings: { last_backup_at: 1 },
  });
  assert.deepEqual(doneOf(firstWeekSteps(d)), { workout: true, meal: true, weigh: true, backup: true, widget: false });
  assert.equal(doneOf(firstWeekSteps(d, { widgetCount: 1 })).widget, true);
  assert.equal(doneOf(firstWeekSteps(markWidgetDone(d))).widget, true);
});

test('a started but unfinished workout, an unticked meal and an empty weigh-in do not count', () => {
  const d = fresh({ workouts: [{ id: 1, finished_at: null }], meal_logs: [{ completed: false }], body_logs: [{ weight_kg: null }] });
  const s = doneOf(firstWeekSteps(d));
  assert.equal(s.workout, false);
  assert.equal(s.meal, false);
  assert.equal(s.weigh, false);
});

test('automatic backup on counts as backed up', () => {
  assert.equal(doneOf(firstWeekSteps(fresh({ settings: { auto_backup: { on: true } } }))).backup, true);
});

test('no weigh-in step for maintain, hidden weight or the weight module off', () => {
  assert.equal(weighStep(fresh()), true);
  assert.equal(weighStep(fresh({ goals: [{ direction: 'gain' }] })), true);
  assert.equal(weighStep(fresh({ goals: [{ direction: 'maintain' }] })), false);
  assert.equal(weighStep(fresh({ safety: { hide_weight: true } })), false);
  assert.equal(weighStep(fresh({ settings: { modules: { weight: false } } })), false);
  assert.ok(!keys(firstWeekSteps(fresh({ goals: [{ direction: 'maintain' }] }))).includes('weigh'));
});

test('no meal step with the meals module off', () => {
  assert.ok(!keys(firstWeekSteps(fresh({ settings: { modules: { meals: false } } }))).includes('meal'));
});

test('the card: two weeks after setup, gone when all done or hidden, never without setup', () => {
  const d = fresh();
  const steps = firstWeekSteps(d);
  assert.equal(showFirstWeek(d, '2026-11-28', steps), true);
  assert.equal(FIRST_WEEK_DAYS, 14);
  assert.equal(showFirstWeek(d, '2026-11-29', steps), false);
  assert.equal(showFirstWeek(d, '2026-11-14', steps), false); // a clock set back
  assert.equal(showFirstWeek(fresh({ setup: undefined }), '2026-11-15', steps), false);
  assert.equal(showFirstWeek(hideFirstWeek(d), '2026-11-15', steps), false);
  assert.equal(showFirstWeek(d, '2026-11-15', steps.map((s) => ({ ...s, done: true }))), false);
});

test('hiding and the widget tick keep each other and other settings', () => {
  const d = markWidgetDone(hideFirstWeek(fresh({ settings: { theme: 'light' } })));
  assert.deepEqual(d.settings, { theme: 'light', first_week: { hidden: true, widget: true } });
});
