import assert from 'node:assert/strict';
import test from 'node:test';

import { daysTickingMeals, isReward, mealTickEvent, rewardScale, tierFor, TIERS } from './rewards.js';

test('every reward event has exactly one tier', () => {
  for (const tier of Object.values(TIERS)) assert.ok(['tick', 'done', 'rare'].includes(tier));
  assert.equal(isReward('set'), true);
  assert.equal(isReward('restDone'), false); // functional cue, not a reward
});

test('Off plays nothing, Gentle keeps ticks quiet, rare is never quieter than done', () => {
  assert.equal(rewardScale('set', { level: 'off' }), 0);
  assert.ok(rewardScale('set', { level: 'gentle' }) < rewardScale('set', { level: 'full' }));
  for (const level of ['gentle', 'full']) {
    assert.ok(rewardScale('pr', { level }) >= rewardScale('workoutSaved', { level }));
    assert.ok(rewardScale('workoutSaved', { level }) > rewardScale('meal', { level }));
  }
  assert.equal(rewardScale('restDone'), 0);
});

test('the all-meals chime fades to a tick after two weeks', () => {
  assert.equal(tierFor('mealsDone', { daysUsing: 3 }), 'done');
  assert.equal(tierFor('mealsDone', { daysUsing: 14 }), 'tick');
  assert.equal(tierFor('workoutSaved', { daysUsing: 400 }), 'done');
});

test('unticking a meal is silent; the last meal of the day is "done"', () => {
  assert.equal(mealTickEvent({ nowDone: false, doneBefore: 3, slots: 4 }), null);
  assert.equal(mealTickEvent({ nowDone: true, doneBefore: 1, slots: 4 }), 'meal');
  assert.equal(mealTickEvent({ nowDone: true, doneBefore: 3, slots: 4 }), 'mealsDone');
});

test('days ticking meals counts from the first ticked meal only', () => {
  const data = { meal_logs: [
    { log_date: '2026-11-01', completed: false },
    { log_date: '2026-11-03', completed: true },
  ] };
  assert.equal(daysTickingMeals(data, '2026-11-10'), 7);
  assert.equal(daysTickingMeals({ meal_logs: [] }, '2026-11-10'), 0);
});
