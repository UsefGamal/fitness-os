import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays } from './dates.js';
import * as D from './data.js';
import { sessionKeyOn } from './schedule.js';
import { content } from './testContent.js';
import { setEvening } from './evening.js';
import { mealWhat, nextMeal, WIDGET_DAYS, widgetDays, widgetPrivate } from './widget.js';

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
      assert.equal(d.kicker, `Today · ${T.session_time}`);
      assert.equal(d.route, 'workout');
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
  assert.equal(first.kicker, 'Done today ✓');
  assert.equal(first.week.find((w) => w.today).s, 'done');
  assert.equal(first.meals.find((m) => m.name === 'Breakfast').done, true);
  assert.match(first.stats, /^Protein [1-9]\d*\/\d+ g · Water 0\.0\/3 L$/);
});

test('meals come in time order with what to eat, and the next one is picked by the clock', () => {
  const [first] = widgetDays(D.emptyData(content), content, today);
  assert.equal(first.meals.length, content.nutrition.meal_slots.length);
  const times = first.meals.map((m) => m.time);
  assert.deepEqual(times, [...times].sort());
  assert.ok(first.meals.every((m) => m.what.length > 0));
  assert.equal(nextMeal(first.meals, '00:00'), first.meals[0]);
  assert.equal(nextMeal(first.meals, '23:59'), null);
  const eaten = first.meals.map((m, i) => ({ ...m, done: i === 0 }));
  assert.equal(nextMeal(eaten, '00:00'), eaten[1]);
});

test('repeated ingredients are counted', () => {
  assert.equal(mealWhat({ ingredients: ['Egg', 'Pita', 'Egg'] }), 'Egg ×2, Pita');
  assert.equal(mealWhat({ ingredients: ['a bowl of ful medames', '2 boiled eggs'] }), 'A bowl of ful medames, 2 boiled eggs');
});

test('a week strip of seven days and tonight\'s session', () => {
  const data = setEvening(D.emptyData(content), 'sunday', 'recovery');
  const [first] = widgetDays(data, content, today);
  assert.equal(first.week.length, 7);
  assert.equal(first.week[0].d, 'S');
  assert.ok(first.week[0].today);
  assert.match(first.tonight, /^Tonight 20:00 · Recovery$/);
});

test('meals and water stay off the widget when their modules are off', () => {
  const data = D.emptyData(content);
  data.settings = { ...data.settings, modules: { meals: false, water: false } };
  const [first] = widgetDays(data, content, today);
  assert.deepEqual(first.meals, []);
  assert.equal(first.stats, '');
});

test('SEC-11: "Hide numbers on the widget" keeps protein, water and the meal off the home screen', () => {
  const data = D.emptyData(content);
  const [shown] = widgetDays(data, content, today);
  assert.notEqual(shown.stats, '');
  assert.equal(widgetPrivate(data), false);
  const hidden = { ...data, settings: { ...data.settings, widget_private: true } };
  const [first] = widgetDays(hidden, content, today);
  assert.equal(first.stats, '');
  assert.ok(first.meals.length > 0);
  assert.ok(first.meals.every((m) => m.what === '' && m.name));
  assert.equal(first.title, shown.title);
});
