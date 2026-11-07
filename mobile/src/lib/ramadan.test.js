import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import { macroTargets } from './macros.js';
import { dropFastingReminders, deficitShare, effectiveTimes, isFasting, RAMADAN_DEFICIT_SHARE, ramadanActive, ramadanOf, ramadanSet, setRamadan, SUGGESTED_DATES, switchRamadan } from './ramadan.js';
import { plannedReminders } from './reminders.js';
import { content } from './testContent.js';
import { timesOf } from './times.js';

const N = content.nutrition;

test('Ramadan mode is off by default, on a new phone and after an upgrade', () => {
  const d = emptyData(content);
  assert.equal(ramadanSet(d), false);
  assert.equal(ramadanActive(d, SUGGESTED_DATES.from), false);
  assert.deepEqual(effectiveTimes(d, content, SUGGESTED_DATES.from), timesOf(d, content));
  assert.equal(ramadanSet({}), false);
});

test('switching on suggests the dates; off keeps them for next time', () => {
  let d = switchRamadan(emptyData(content), true);
  assert.deepEqual([ramadanOf(d).from, ramadanOf(d).to], [SUGGESTED_DATES.from, SUGGESTED_DATES.to]);
  d = setRamadan(d, { from: '2027-02-09' });
  d = switchRamadan(d, false);
  assert.equal(ramadanSet(d), false);
  d = switchRamadan(d, true);
  assert.equal(ramadanOf(d).from, '2027-02-09');
  // Bad values fall back.
  assert.deepEqual(ramadanOf(setRamadan(d, { iftar: '25:00', from: 'soon' })).iftar, '17:45');
  assert.equal(ramadanSet(setRamadan(d, { from: '2027-03-10' })), false); // ends before it starts
});

test('active only between the dates, both included', () => {
  const d = setRamadan(emptyData(content), { from: '2027-02-08', to: '2027-03-09' });
  assert.equal(ramadanActive(d, '2027-02-07'), false);
  assert.equal(ramadanActive(d, '2027-02-08'), true);
  assert.equal(ramadanActive(d, '2027-03-09'), true);
  assert.equal(ramadanActive(d, '2027-03-10'), false);
});

test('times move: session 90 min after iftar, meals between iftar and suhoor', () => {
  const d = setRamadan(emptyData(content), { from: '2027-02-08', to: '2027-03-09', iftar: '17:45', suhoor: '04:15' });
  const t = effectiveTimes(d, content, '2027-02-10');
  assert.equal(t.ramadan, true);
  assert.equal(t.session_time, '19:15');
  assert.deepEqual(t.meal_times, { breakfast: '03:30', snack1: '17:45', lunch: '18:05', snack2: '21:45', dinner: '22:00' });
  const r = ramadanOf(d);
  assert.equal(isFasting(r, '12:00'), true);
  assert.equal(isFasting(r, '04:15'), true);
  assert.equal(isFasting(r, '17:45'), false);
  assert.equal(isFasting(r, '03:30'), false);
  for (const v of [t.session_time, t.evening_time, ...Object.values(t.meal_times)]) assert.equal(isFasting(r, v), false, v);
  // An evening slot inside fasting hours moves after iftar too.
  const e = effectiveTimes({ ...d, settings: { ...d.settings, times: { evening_time: '16:00' } } }, content, '2027-02-10');
  assert.equal(e.evening_time, '21:15');
});

test('the deficit is at most 15%, and none with the no_fasting_deficit gate', () => {
  assert.equal(deficitShare({}, '2027-02-10', 1), 1);
  const d = setRamadan(emptyData(content), { from: '2027-02-08', to: '2027-03-09' });
  assert.equal(deficitShare(d, '2027-02-10', 1), RAMADAN_DEFICIT_SHARE);
  assert.equal(deficitShare(d, '2027-02-10', 0.1), 0.1);
  assert.equal(deficitShare(d, '2027-03-10', 1), 1);
  d.profile = { height_cm: 180, date_of_birth: '1994-01-01', gender: 'male', activity_level: 'moderate', start_weight_kg: 100, goal_weight_low_kg: 80, goal_weight_high_kg: 82, goal_date: '2027-03-15' };
  d.body_logs = [{ id: 1, log_date: '2027-02-01', weight_kg: 100 }];
  const before = macroTargets(d, N, '2027-02-07');
  const during = macroTargets(d, N, '2027-02-10');
  assert.equal(during.ramadan, true);
  assert.ok(before.deficit > during.tdee * RAMADAN_DEFICIT_SHARE + 1, 'the plain target is a deeper cut');
  assert.ok(during.deficit <= Math.ceil(during.tdee * RAMADAN_DEFICIT_SHARE), `${during.deficit} vs ${during.tdee}`);
  d.safety.gates.no_fasting_deficit = true;
  const gated = macroTargets(d, N, '2027-02-10');
  assert.equal(gated.deficit, 0);
  assert.equal(macroTargets(d, N, '2027-02-07').deficit, before.deficit);
});

test('no reminder rings while fasting', () => {
  const d = setRamadan(emptyData(content), { from: '2026-11-04', to: '2026-11-30', iftar: '17:00', suhoor: '04:30' });
  const now = new Date(2026, 10, 3, 5, 0);
  // Planned with the normal times (made before Ramadan), the fasting ones are dropped.
  const plain = plannedReminders('2026-11-03', content, now);
  const kept = dropFastingReminders(plain, d);
  assert.ok(kept.length < plain.length);
  const r = ramadanOf(d);
  const hhmm = (x) => `${String(x.at.getHours()).padStart(2, '0')}:${String(x.at.getMinutes()).padStart(2, '0')}`;
  for (const x of kept) if (x.at.getDate() >= 4) assert.equal(isFasting(r, hhmm(x)), false, hhmm(x));
  // The day before Ramadan keeps its daytime reminders.
  assert.ok(kept.some((x) => x.at.getDate() === 3 && isFasting(r, hhmm(x))));
  // Planned with Ramadan times, nothing is dropped on Ramadan days.
  const moved = plannedReminders('2026-11-05', content, new Date(2026, 10, 5, 1, 0), [], {}, effectiveTimes(d, content, '2026-11-05'));
  assert.deepEqual(dropFastingReminders(moved, d), moved);
  assert.equal(dropFastingReminders(plain, emptyData(content)), plain);
});
