import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultTimes, isTime, setTimes, shiftTime, timesOf } from './times.js';
import { content } from './testContent.js';

test('defaults come from the plan and the meal windows', () => {
  const d = defaultTimes(content);
  assert.equal(d.session_time, content.training.session_time);
  assert.equal(d.evening_time, '20:00');
  assert.equal(d.remind_before, 30);
  assert.ok(Object.values(d.meal_times).every(isTime));
});

test('changes are kept, bad values fall back to defaults', () => {
  let data = { settings: { notifications: true } };
  data = setTimes(data, { session_time: '06:15', remind_before: 15 });
  data = setTimes(data, { meal_times: { lunch: '13:30' } });
  data = setTimes(data, { meal_times: { dinner: '19:45' } });
  const t = timesOf(data, content);
  assert.equal(t.session_time, '06:15');
  assert.equal(t.remind_before, 15);
  assert.equal(t.meal_times.lunch, '13:30');
  assert.equal(t.meal_times.dinner, '19:45');
  assert.equal(data.settings.notifications, true);
  const bad = timesOf(setTimes(data, { session_time: '25:00', remind_before: 7 }), content);
  assert.equal(bad.session_time, content.training.session_time);
  assert.equal(bad.remind_before, 30);
});

test('shifting a time wraps around midnight', () => {
  assert.deepEqual(shiftTime('07:00', -30), { time: '06:30', dayShift: 0 });
  assert.deepEqual(shiftTime('00:10', -30), { time: '23:40', dayShift: -1 });
  assert.deepEqual(shiftTime('23:50', 20), { time: '00:10', dayShift: 1 });
});
