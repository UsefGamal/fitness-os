import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays } from './dates.js';
import * as D from './data.js';
import { sessionKeyOn } from './schedule.js';
import { content } from './testContent.js';
import { WIDGET_DAYS, widgetDays } from './widget.js';

const T = content.training;
const today = '2026-11-01'; // a Sunday

test('one entry per day for the coming week', () => {
  const days = widgetDays(D.emptyData(content), content, today);
  assert.equal(days.length, WIDGET_DAYS);
  assert.deepEqual(days.map((d) => d.date), Array.from({ length: 7 }, (_, i) => addDays(today, i)));
});

test('training days name the session, rest days the next one', () => {
  const days = widgetDays(D.emptyData(content), content, today);
  for (const d of days) {
    if (sessionKeyOn(d.date, T) === 'rest') {
      assert.equal(d.kicker, 'Rest day');
      assert.match(d.title, /^Next: /);
    } else {
      assert.equal(d.kicker, `Today at ${T.session_time}`);
      assert.ok(d.title.length > 0);
    }
  }
});

test('today shows meals eaten, and done once the workout is finished', () => {
  let data = D.emptyData(content);
  const training = Array.from({ length: 7 }, (_, i) => addDays(today, i)).find((d) => sessionKeyOn(d, T) !== 'rest');
  data = D.setMeal(data, training, 'breakfast', { completed: true });
  const s = D.startWorkout(data, { date: training, sessionKey: sessionKeyOn(training, T), label: 'x' });
  data = D.finishWorkout(s.data, s.workoutId, { now: 1 });
  const [first] = widgetDays(data, content, training);
  assert.equal(first.kicker, 'Done today');
  assert.match(first.footer, new RegExp(`Meals 1/${content.nutrition.meal_slots.length}`));
});
