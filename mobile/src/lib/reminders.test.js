import assert from 'node:assert/strict';
import test from 'node:test';

import { plannedReminders } from './reminders.js';
import { content } from './testContent.js';

test('workout reminder 30 min before the session on training days only, plus meal times', () => {
  const now = new Date(2026, 10, 3, 5, 0); // Tue 3 Nov 05:00, a rest day
  const r = plannedReminders('2026-11-03', content, now);
  const workouts = r.filter((x) => x.id < 2000);
  assert.equal(workouts[0].title, 'Push at 07:00');
  assert.equal(workouts[0].at.getDate(), 4);
  assert.equal(workouts[0].at.getHours(), 6);
  assert.equal(workouts[0].at.getMinutes(), 30);
  const tuesdayMeals = r.filter((x) => x.id >= 2000 && x.at.getDate() === 3);
  assert.equal(tuesdayMeals.length, 5);
  assert.equal(tuesdayMeals[0].at.getHours(), 8);
  assert.equal(new Set(r.map((x) => x.id)).size, r.length);
});

test('nothing in the past is scheduled', () => {
  const now = new Date(2026, 10, 4, 12, 0);
  const r = plannedReminders('2026-11-04', content, now);
  assert.ok(r.every((x) => x.at > now));
  assert.ok(!r.some((x) => x.title.startsWith('Push') && x.at.getDate() === 4));
});
