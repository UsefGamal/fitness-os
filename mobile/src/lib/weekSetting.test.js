// WEEK-1: the week start setting and "my training time varies".
import assert from 'node:assert/strict';
import test from 'node:test';

import * as D from './data.js';
import { startsMonday, weekStart } from './dates.js';
import { introLine } from './intro.js';
import { weekText } from './planShare.js';
import { weekOf } from './recovery.js';
import { plannedReminders } from './reminders.js';
import { weekView } from './schedule.js';
import { finishSetup } from './setup.js';
import { content } from './testContent.js';
import { defaultTimes, sessionAt, setTimes, timesOf } from './times.js';
import { wrapWeek } from './weekStats.js';
import { widgetDays } from './widget.js';

const MON = { profile: { week_start: 'mon' } };
const SUN = { profile: { week_start: 'sun' } };

test('week start: Sunday by default, Monday when set', () => {
  // Wed 11 Nov 2026.
  assert.equal(weekStart('2026-11-11'), '2026-11-08');
  assert.equal(weekStart('2026-11-11', SUN), '2026-11-08');
  assert.equal(weekStart('2026-11-11', MON), '2026-11-09');
  // A Sunday is the last day of a Monday week.
  assert.equal(weekStart('2026-11-08', MON), '2026-11-02');
  assert.equal(weekStart('2026-11-09', MON), '2026-11-09');
  assert.equal(weekStart('2026-11-11', 'mon'), '2026-11-09');
  assert.equal(startsMonday({}), false);
  // The recovery week follows the same rule.
  assert.equal(weekOf(MON, '2026-11-08'), weekStart('2026-11-08', MON));
});

test('week start: the Plan week runs Monday to Sunday', () => {
  const T = content.training;
  const sun = weekView('2026-11-11', T, [], SUN);
  const mon = weekView('2026-11-11', T, [], MON);
  assert.deepEqual([sun[0].short, sun[6].short], ['Sun', 'Sat']);
  assert.deepEqual([mon[0].short, mon[6].short], ['Mon', 'Sun']);
  assert.equal(mon[0].date, '2026-11-09');
  // The same day keeps the same session, whatever the week start.
  const key = (w, date) => w.find((d) => d.date === date)?.key;
  for (const d of mon) if (sun.some((s) => s.date === d.date)) assert.equal(key(mon, d.date), key(sun, d.date));
});

test('week start: the wrap-up comes on the first two days of the week', () => {
  // Sunday 8 Nov and Monday 9 Nov for a Sunday week.
  assert.equal(wrapWeek('2026-11-08', SUN), '2026-11-01');
  assert.equal(wrapWeek('2026-11-10', SUN), null);
  // Monday 9 Nov and Tuesday 10 Nov for a Monday week, about 2-8 Nov.
  assert.equal(wrapWeek('2026-11-08', MON), null);
  assert.equal(wrapWeek('2026-11-09', MON), '2026-11-02');
  assert.equal(wrapWeek('2026-11-10', MON), '2026-11-02');
  assert.equal(wrapWeek('2026-11-11', MON), null);
});

test('it varies: no session time, no timed session reminder', () => {
  const d = setTimes(D.emptyData(content), { session_varies: true });
  const times = timesOf(d, content);
  assert.equal(times.session_varies, true);
  assert.equal(sessionAt(times), null);
  assert.equal(sessionAt(timesOf(D.emptyData(content), content)), content.training.session_time);
  const now = new Date(2026, 10, 9, 5, 0);
  const all = plannedReminders('2026-11-09', content, now, [], {}, { ...defaultTimes(content), remind_meals: true });
  const varied = plannedReminders('2026-11-09', content, now, [], {}, { ...times, remind_meals: true });
  assert.ok(all.some((r) => r.route === '/workout'));
  assert.equal(varied.some((r) => r.route === '/workout'), false);
  // Meal reminders stay.
  assert.ok(varied.some((r) => r.route === '/meals'));
});

test('it varies: Home, the widget and the shared week show no time', () => {
  assert.equal(introLine({ next: { label: 'Push' }, time: null }), 'Push today');
  assert.equal(introLine({ next: { label: 'Push' }, time: '07:00' }), 'Push today at 07:00');
  const days = weekView('2026-11-11', content.training, []).filter((w) => w.key !== 'rest').map((w) => ({ date: w.date, day: { label: w.label, exercises: [] } }));
  assert.ok(!/ at /.test(weekText(days, { time: '' })));
  const d = setTimes(D.emptyData(content), { session_varies: true });
  const out = JSON.stringify(widgetDays(d, content, '2026-11-11'));
  assert.ok(!out.includes(content.training.session_time), out.slice(0, 200));
});

test('it varies: first-time setup keeps the answer', () => {
  const answers = { goal: 'lose', where: 'gym', days: 3, experience: 'new', job: 'desk', session_varies: true };
  const d = finishSetup(D.emptyData(content), content, answers, '2026-11-11');
  assert.equal(timesOf(d, content).session_varies, true);
});
