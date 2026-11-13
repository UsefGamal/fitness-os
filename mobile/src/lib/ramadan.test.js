import assert from 'node:assert/strict';
import test from 'node:test';

import { emptyData } from './data.js';
import { macroTargets } from './macros.js';
import { AFTER_EID_DAYS, afterRamadan, dropFastingReminders, deficitShare, effectiveTimes, goalSlipDays, isFasting, LAST_TIME, mealDay, RAMADAN_DEFICIT_SHARE, ramadanActive, ramadanOf, ramadanSet, setRamadan, SUGGESTED_DATES, switchRamadan } from './ramadan.js';
import { plannedReminders } from './reminders.js';
import { content } from './testContent.js';
import { weekStats, wrapDue, weekText } from './weekStats.js';
import { defaultTimes, timesOf } from './times.js';

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
  // Meal reminders are opt-in, so switch them on to have daytime ones.
  const withMeals = { ...defaultTimes(content), remind_meals: true };
  const plain = plannedReminders('2026-11-03', content, now, [], {}, withMeals);
  const kept = dropFastingReminders(plain, d);
  assert.ok(kept.length < plain.length);
  const r = ramadanOf(d);
  const hhmm = (x) => `${String(x.at.getHours()).padStart(2, '0')}:${String(x.at.getMinutes()).padStart(2, '0')}`;
  for (const x of kept) if (x.at.getDate() >= 4) assert.equal(isFasting(r, hhmm(x)), false, hhmm(x));
  // The day before Ramadan keeps its daytime reminders.
  assert.ok(kept.some((x) => x.at.getDate() === 3 && isFasting(r, hhmm(x))));
  // Planned with Ramadan times, nothing is dropped on Ramadan days.
  const moved = plannedReminders('2026-11-05', content, new Date(2026, 10, 5, 1, 0), [], {}, { ...effectiveTimes(d, content, '2026-11-05'), remind_meals: true });
  assert.deepEqual(dropFastingReminders(moved, d), moved);
  assert.equal(dropFastingReminders(plain, emptyData(content)), plain);
});

// ── Clock tests (RAM-1): iftar, suhoor, midnight, wrap-up ─────────────

const RAM = { from: '2027-02-08', to: '2027-03-09' };
const loser = (d) => ({
  ...d,
  profile: { height_cm: 180, date_of_birth: '1994-01-01', gender: 'male', activity_level: 'moderate', start_weight_kg: 100, goal_weight_low_kg: 80, goal_weight_high_kg: 82, goal_date: '2027-06-15' },
  body_logs: [{ id: 1, log_date: '2027-02-01', weight_kg: 100 }],
});

test('clock: the minute of suhoor starts the fast, the minute of iftar ends it', () => {
  const r = ramadanOf(setRamadan(emptyData(content), { ...RAM, suhoor: '04:15', iftar: '17:45' }));
  assert.equal(isFasting(r, '04:14'), false);
  assert.equal(isFasting(r, '04:15'), true);
  assert.equal(isFasting(r, '17:44'), true);
  assert.equal(isFasting(r, '17:45'), false);
  assert.equal(isFasting(r, '00:00'), false);
  assert.equal(isFasting(r, '23:59'), false);
});

test('clock: a late summer iftar never pushes a time past midnight', () => {
  const d = setRamadan(emptyData(content), { ...RAM, iftar: '20:50', suhoor: '02:40' });
  const t = effectiveTimes(d, content, '2027-02-10');
  assert.equal(t.session_time, '22:20');
  assert.equal(t.meal_times.snack1, '20:50');
  assert.equal(t.meal_times.snack2, LAST_TIME); // 00:50 would be tomorrow
  assert.equal(t.meal_times.dinner, LAST_TIME);
  assert.equal(t.meal_times.breakfast, '01:55');
  const r = ramadanOf(d);
  for (const v of [t.session_time, ...Object.values(t.meal_times)]) assert.equal(isFasting(r, v), false, v);
  // A winter iftar keeps the usual gaps.
  assert.equal(effectiveTimes(setRamadan(d, { iftar: '17:00' }), content, '2027-02-10').meal_times.dinner, '21:15');
});

test('clock: after midnight Meals stays on last night until near suhoor', () => {
  const d = setRamadan(emptyData(content), { ...RAM, suhoor: '04:15' });
  // The night after the first fast.
  assert.equal(mealDay(d, '2027-02-09', '00:30'), '2027-02-08');
  assert.equal(mealDay(d, '2027-02-09', '02:44'), '2027-02-08');
  assert.equal(mealDay(d, '2027-02-09', '02:45'), '2027-02-09'); // suhoor time: the new day
  assert.equal(mealDay(d, '2027-02-09', '12:00'), '2027-02-09');
  // The night before the first fast is a normal night.
  assert.equal(mealDay(d, '2027-02-08', '00:30'), '2027-02-08');
  // Eid night: the last fast's late meal still counts for it.
  assert.equal(mealDay(d, '2027-03-10', '00:30'), '2027-03-09');
  assert.equal(mealDay(d, '2027-03-11', '00:30'), '2027-03-11');
  assert.equal(mealDay(emptyData(content), '2027-02-09', '00:30'), '2027-02-09');
});

test('clock: the deficit changes at the day boundary, not at iftar', () => {
  const d = loser(setRamadan(emptyData(content), RAM));
  assert.equal(macroTargets(d, N, '2027-02-07').ramadan, undefined);
  assert.equal(macroTargets(d, N, '2027-02-08').ramadan, true);
  assert.equal(macroTargets(d, N, '2027-03-09').ramadan, true);
  assert.equal(macroTargets(d, N, '2027-03-10').ramadan, undefined);
});

test('goal date: moves by the Ramadan days times the deficit given up', () => {
  const d = loser(setRamadan(emptyData(content), RAM));
  const on = (iso) => macroTargets(d, N, iso);
  const slip = goalSlipDays(d, on);
  const before = on('2027-02-07').deficit;
  const during = on('2027-02-08').deficit;
  assert.equal(slip, Math.round(30 * (before - during) / before));
  assert.ok(slip > 0 && slip < 30, String(slip));
  // No deficit at all while fasting: every Ramadan day is a day later.
  const gated = { ...d, safety: { ...d.safety, gates: { ...d.safety.gates, no_fasting_deficit: true } } };
  assert.equal(goalSlipDays(gated, (iso) => macroTargets(gated, N, iso)), 30);
  // Not losing, or off: nothing moves.
  const gain = { ...d, profile: { ...d.profile, goal_weight_low_kg: 110, goal_weight_high_kg: 112 } };
  assert.equal(goalSlipDays(gain, (iso) => macroTargets(gain, N, iso)), null);
  assert.equal(goalSlipDays(emptyData(content), on), null);
});

test('after Eid: the water-weight note shows for two weeks, never with weight hidden', () => {
  const d = setRamadan(emptyData(content), RAM);
  assert.equal(afterRamadan(d, '2027-03-09'), null); // still fasting
  assert.equal(afterRamadan(d, '2027-03-10'), 1); // Eid
  assert.equal(afterRamadan(d, '2027-03-23'), AFTER_EID_DAYS);
  assert.equal(afterRamadan(d, '2027-03-24'), null);
  assert.equal(afterRamadan({ ...d, safety: { ...d.safety, hide_weight: true } }, '2027-03-10'), null);
  assert.equal(afterRamadan(emptyData(content), '2027-03-10'), null);
});

test('wrap-up in a Ramadan week: due as usual, and Ramadan never named', () => {
  const d = setRamadan(emptyData(content), RAM);
  // Sunday 14 Feb 2027 wraps up 7-13 Feb, which starts the day before Ramadan.
  d.workouts = [{ id: 1, log_date: '2027-02-10', workout_type: 'gym', finished_at: '2027-02-10T19:30:00', sets: [{ id: 2, exercise_id: 1, set_number: 1, reps: 8, weight_kg: 40, is_warmup: false }] }];
  assert.equal(wrapDue(d, content, '2027-02-14'), true);
  const s = weekStats(d, content, '2027-02-07');
  assert.equal(s.sessions.done, 1);
  assert.ok(!/ramadan|fast|iftar|suhoor/i.test(weekText(s) + JSON.stringify(s)));
});
