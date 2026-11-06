// Plan edits that combine (QA-01, QA-02): routine switches, one-off day
// changes, weekday edits and whole rest weeks must never crash the week view,
// "what's next", the widget or the reminders.
import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays } from './dates.js';
import { emptyData } from './data.js';
import { activePlan, setWeekday } from './plan.js';
import { plannedReminders } from './reminders.js';
import { routinesOf, startRoutine } from './routines.js';
import { programDayFor, sessionKeyOn, setSessionOn, weekView } from './schedule.js';
import { content } from './testContent.js';
import { widgetDays } from './widget.js';

const SUNDAY = '2026-11-08';
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function checkAll(data, today) {
  const T = activePlan(data, content);
  const moves = data.session_moves || [];
  const week = weekView(today, T, moves);
  assert.equal(week.length, 7);
  for (const d of week) assert.ok(d.key === 'rest' || T.program.some((p) => p.key === d.key), `${d.date} ${d.key}`);
  const next = programDayFor(today, T, moves);
  assert.ok(next === null || typeof next.label === 'string');
  widgetDays(data, content, today);
  plannedReminders(today, { ...content, training: T }, new Date(`${today}T05:00:00`), moves);
}

test('a routine switch after a one-off change earlier in the week does not crash (QA-01)', () => {
  let d = emptyData(content);
  d = startRoutine(d, content, 'starter-3', SUNDAY);
  const fb = activePlan(d, content);
  // Sunday: train Full body B on Monday (a rest day) as a one-off.
  d = setSessionOn(d, fb, addDays(SUNDAY, 1), fb.program[1].key);
  // Wednesday: switch to Upper/lower.
  const wed = addDays(SUNDAY, 3);
  d = startRoutine(d, content, 'upper-lower-4', wed);
  const T = activePlan(d, content);
  assert.ok(d.session_moves.every((m) => m.key === 'rest' || T.program.some((p) => p.key === m.key)), 'old-plan moves dropped');
  assert.notEqual(sessionKeyOn(addDays(SUNDAY, 1), T, d.session_moves), fb.program[1].key);
  checkAll(d, wed);
});

test('a move kept from an older plan reads as rest, never as a crash', () => {
  const T = activePlan(emptyData(content), content);
  const moves = [{ from: null, to: SUNDAY, key: 'no_such_session' }];
  assert.equal(sessionKeyOn(SUNDAY, T, moves), 'rest');
  assert.equal(weekView(SUNDAY, T, moves)[0].label, 'Rest');
});

test('a whole week set to rest gives no next session instead of a crash (QA-02)', () => {
  // QA's repro: set Sun, Tue and Thu of a 3-day plan to Rest, one day at a time.
  let d = startRoutine(emptyData(content), content, 'starter-3', SUNDAY);
  const T = activePlan(d, content);
  for (let i = 0; i < 7; i += 1) d = setSessionOn(d, T, addDays(SUNDAY, i), 'rest');
  assert.ok(weekView(SUNDAY, T, d.session_moves).every((w) => w.key === 'rest'));
  // "Next" is next Sunday's session; Plan opens on today's rest day.
  assert.equal(programDayFor(SUNDAY, T, d.session_moves).onDate, addDays(SUNDAY, 7));
  checkAll(d, SUNDAY);
});

test('eight one-off rest days in a row (a holiday) do not crash', () => {
  let d = emptyData(content);
  const T = activePlan(d, content);
  for (let i = 0; i < 8; i += 1) d = setSessionOn(d, T, addDays(SUNDAY, i), 'rest');
  assert.equal(programDayFor(SUNDAY, T, d.session_moves), null);
  checkAll(d, SUNDAY);
  assert.equal(widgetDays(d, content, SUNDAY)[0].title, 'No session this week');
});

test('1,000 random edit sequences over 8 weeks never crash', () => {
  let seed = 7;
  const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const ids = routinesOf(content).map((r) => r.id);
  for (let run = 0; run < 1000; run += 1) {
    let d = emptyData(content);
    for (let step = 0; step < 6; step += 1) {
      const today = addDays(SUNDAY, rand(56));
      const T = activePlan(d, content);
      const keys = ['rest', ...T.program.map((p) => p.key)];
      const kind = rand(3);
      if (kind === 0) d = startRoutine(d, content, ids[rand(ids.length)], today);
      else if (kind === 1) d = setSessionOn(d, T, addDays(today, rand(7) - 3), keys[rand(keys.length)]);
      else d = setWeekday(d, content, WEEKDAYS[rand(7)], keys[rand(keys.length)]);
      checkAll(d, today);
    }
  }
});
