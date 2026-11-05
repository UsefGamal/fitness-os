import assert from 'node:assert/strict';
import test from 'node:test';

import * as D from './data.js';
import { setEvening } from './evening.js';
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

test('an 8 PM session gets a reminder at 19:30', () => {
  const now = new Date(2026, 10, 4, 6, 0);
  const r = plannedReminders('2026-11-04', content, now, [], { wednesday: 'tabata' });
  const night = r.filter((x) => x.id >= 3000 && x.id < 4000);
  assert.ok(night.length >= 1);
  assert.equal(night[0].at.getHours(), 19);
  assert.equal(night[0].at.getMinutes(), 30);
  assert.match(night[0].title, /Tabata at 20:00/);
});

test('custom times: session at 06:00 reminded 15 min early, meals off, evening at 21:00', async () => {
  const { defaultTimes } = await import('./times.js');
  const times = { ...defaultTimes(content), session_time: '06:00', evening_time: '21:00', remind_before: 15, remind_meals: false };
  const now = new Date(2026, 10, 3, 5, 0);
  const r = plannedReminders('2026-11-03', content, now, [], { wednesday: 'tabata' }, times);
  const push = r.find((x) => x.title === 'Push at 06:00');
  assert.equal(push.at.getHours(), 5);
  assert.equal(push.at.getMinutes(), 45);
  assert.ok(!r.some((x) => x.id >= 2000 && x.id < 3000));
  const night = r.find((x) => x.id >= 3000);
  assert.equal(night.title, 'Tabata at 21:00');
  assert.equal(night.at.getHours(), 20);
  assert.equal(night.at.getMinutes(), 45);
});

test('a reminder before a just-after-midnight time lands the evening before', async () => {
  const { defaultTimes } = await import('./times.js');
  const times = { ...defaultTimes(content), session_time: '00:10', remind_before: 30, remind_meals: false };
  const r = plannedReminders('2026-11-03', content, new Date(2026, 10, 3, 1, 0), [], {}, times);
  const push = r.find((x) => x.title === 'Push at 00:10');
  assert.equal(push.at.getDate(), 3);
  assert.equal(push.at.getHours(), 23);
  assert.equal(push.at.getMinutes(), 40);
});

test('every reminder says which screen a tap opens', () => {
  const data = setEvening(D.emptyData(content), 'monday', 'recovery');
  const list = plannedReminders('2026-11-01', content, new Date(2026, 10, 1, 0, 0), [], data.evening_plan);
  assert.ok(list.length > 0);
  for (const r of list) {
    if (r.id >= 3000) assert.equal(r.route, '/session/recovery');
    else if (r.id >= 2000) assert.equal(r.route, '/meals');
    else assert.equal(r.route, '/workout');
  }
  assert.ok(list.some((r) => r.id >= 3000));
});
