import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { homeCard } from './homeCard.js';
import { dismissWrap, hasWeek, identityLine, pictureLines, summaryLine, weekStats, weekText, wrapDue, wrapWeek } from './weekStats.js';

const content = JSON.parse(readFileSync(new URL('../content.json', import.meta.url), 'utf8'));
const SLOTS = content.nutrition.meal_slots;

let id = 1;
const sets = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: id++, exercise_id: 1, set_number: i + 1, reps: 10, weight_kg: 50, is_warmup: false, ...extra }));
const workout = (log_date, n, extra = {}) => ({ id: id++, log_date, workout_type: 'gym', finished_at: `${log_date}T08:00:00`, sets: sets(n), ...extra });
const meals = (log_date, slots, protein) => slots.map((s) => ({ id: id++, log_date, meal_slot: s, completed: true, option_key: 'option_a', eaten: { kcal: 777, protein, carbs: 10, fat: 5, fiber: 1 } }));

/** A hand-built fortnight: 1-7 Nov is the week under test, 8-14 Nov the next. */
function fortnight() {
  return {
    exercises: [{ id: 1, name: 'Bench', muscle_group: 'Chest' }],
    program: { blocks: [{ started_on: '2026-10-01', schedule: ['upper', 'rest', 'lower', 'rest', 'push', 'pull', 'rest'].map((session) => ({ session })) }] },
    workouts: [
      { ...workout('2026-11-01', 2), sets: [...sets(2), ...sets(1, { is_warmup: true })] },
      workout('2026-11-03', 3, { is_deload: true }), // a recovery week counts like any other
      workout('2026-11-05', 1),
      workout('2026-11-05', 1), // a second workout the same day: one training day
      workout('2026-11-09', 5), // next week: not counted
    ],
    meal_logs: [
      ...meals('2026-11-02', SLOTS, 40), // every meal, 200 g protein
      ...meals('2026-11-04', SLOTS, 20), // every meal, 100 g
      ...meals('2026-11-06', SLOTS.slice(0, 3), 60), // 3 meals, 180 g
      { id: id++, log_date: '2026-11-07', meal_slot: 'breakfast', completed: false, option_key: null },
    ],
    // Numbers that must never leak into the wrap-up.
    body_logs: [{ log_date: '2026-11-02', weight_kg: 93.7, waist_cm: 101.3 }],
    health_daily: {
      '2026-11-01': { steps: 1000, sleep_min: 400, active_kcal: 4321 },
      '2026-11-02': { steps: 2000, sleep_min: 420 },
      '2026-11-03': { steps: 3000 },
      '2026-11-10': { steps: 90000 },
    },
    diet: { ramadan: { from: '2026-11-01', to: '2026-11-30' } },
    settings: {},
    safety: { screen_version: 1, gates: {} },
  };
}

test('weekStats: every field of a known week (golden)', () => {
  const s = weekStats(fortnight(), content, '2026-11-04');
  assert.deepEqual(s, {
    week: { start: '2026-11-01', end: '2026-11-07' },
    sessions: { done: 3, planned: 4 },
    workSets: 7,
    mealDays: 2,
    proteinDays: 2,
    steps: 2000,
    sleepMin: null, // worn only 2 nights
    kept: true, // 3 of 4: one missed session keeps the week
    streak: 1,
    trainedDespite: true, // trained on 3 days with no meal ticked
  });
});

test('weekStats: a week before any data is all zeros and not kept', () => {
  const s = weekStats(fortnight(), content, '2026-10-18');
  assert.deepEqual(s.sessions, { done: 0, planned: 4 });
  assert.equal(s.workSets, 0);
  assert.equal(s.mealDays, 0);
  assert.equal(s.proteinDays, 0);
  assert.equal(s.kept, false);
  assert.equal(s.trainedDespite, null);
  assert.equal(hasWeek(s), false);
});

test('weekStats: no protein under the protein limit or with calories hidden', () => {
  const capped = { ...fortnight(), safety: { screen_version: 1, gates: { protein_cap: true } } };
  assert.equal(weekStats(capped, content, '2026-11-01').proteinDays, null);
  const hidden = { ...fortnight(), safety: { screen_version: 1, gates: {}, hide_kcal: true } };
  assert.equal(weekStats(hidden, content, '2026-11-01').proteinDays, null);
});

test('weekStats: a week with no plan has no planned count', () => {
  const s = weekStats({ ...fortnight(), program: null }, content, '2026-11-01');
  assert.equal(s.sessions.planned, null);
  assert.equal(summaryLine(s), '3 sessions · 7 sets');
});

test('identity line: streak, else kept, else showed up, else nothing', () => {
  const base = { sessions: { done: 2, planned: 4 }, kept: false, streak: 0 };
  assert.equal(identityLine({ ...base, streak: 3, kept: true }), '3 weeks kept.');
  assert.equal(identityLine({ ...base, streak: 1, kept: true }), 'Week kept.');
  assert.equal(identityLine(base), 'You showed up 2 times.');
  assert.equal(identityLine({ ...base, sessions: { done: 1, planned: 4 } }), 'You showed up.');
  assert.equal(identityLine({ ...base, sessions: { done: 0, planned: 4 } }), '');
});

test('no word of blame anywhere in the wrap-up text', () => {
  const s = weekStats(fortnight(), content, '2026-11-01');
  const all = [summaryLine(s), identityLine(s), weekText(s, { feel: '' }), ...pictureLines(s).flatMap((l) => [l.label, l.value])].join('\n');
  for (const w of ['missed', 'failed', 'only', 'behind', 'should']) assert.ok(!new RegExp(`\\b${w}\\b`, 'i').test(all), w);
});

test('send my week: the text a friend reads before sending', () => {
  const s = weekStats(fortnight(), content, '2026-11-01');
  assert.equal(weekText(s, { feel: ' Tired but good ', check: 'W 12 · S 140 · 3F9A-12CD' }), [
    'My week on Fitness OS (1 Nov to 7 Nov)',
    'Sessions: 3 of 4',
    'Work sets: 7',
    'Days every meal was ticked: 2',
    'Protein days: 2',
    'How it felt: Tired but good',
    'Data check: W 12 · S 140 · 3F9A-12CD',
  ].join('\n'));
  // No feeling typed, no check: those lines are left out.
  assert.equal(weekText(s).split('\n').length, 5);
});

test('privacy: no weight, waist, kcal or watch calories in the text or the picture', () => {
  const data = fortnight();
  const s = weekStats(data, content, '2026-11-01');
  const out = [weekText(s, { feel: 'ok' }), JSON.stringify(pictureLines(s)), JSON.stringify(s)].join('\n');
  for (const n of ['93.7', '101.3', '777', '4321', 'ramadan', 'kcal', 'weight']) assert.ok(!out.toLowerCase().includes(n), n);
  // The picture is effort only: no meals, no protein.
  assert.deepEqual(pictureLines(s).map((l) => l.label), ['Sessions', 'Work sets', 'Weeks kept in a row']);
});

test('when: Sunday and Monday only, about the week that just ended', () => {
  assert.equal(wrapWeek('2026-11-07'), null); // Saturday
  assert.equal(wrapWeek('2026-11-08'), '2026-11-01'); // Sunday
  assert.equal(wrapWeek('2026-11-09'), '2026-11-01'); // Monday
  assert.equal(wrapWeek('2026-11-10'), null); // Tuesday
  const data = fortnight();
  assert.equal(wrapDue(data, content, '2026-11-07'), false);
  assert.equal(wrapDue(data, content, '2026-11-08'), true);
  assert.equal(wrapDue(data, content, '2026-11-09'), true);
  // Dismissed: gone for that week only.
  const seen = dismissWrap(data, '2026-11-08');
  assert.equal(seen.settings.wrapup_seen, '2026-11-01');
  assert.equal(wrapDue(seen, content, '2026-11-09'), false);
  assert.equal(wrapDue(seen, content, '2026-11-15'), true);
  assert.equal(dismissWrap(data, '2026-11-10'), data);
});

test('when: not in the first week after setup, and not for a quiet week', () => {
  const fresh = { ...fortnight(), setup: { done_on: '2026-11-03' } };
  assert.equal(wrapDue(fresh, content, '2026-11-08'), false);
  assert.equal(wrapDue({ ...fortnight(), setup: { done_on: '2026-10-20' } }, content, '2026-11-08'), true);
  const quiet = { ...fortnight(), workouts: [], meal_logs: [] };
  assert.equal(wrapDue(quiet, content, '2026-11-08'), false);
});

test('home card priority: doctor note, welcome back, wrap-up, recovery', () => {
  const data = fortnight();
  const doctor = { ...data, safety: { screen_version: 1, gates: { needs_clearance: true } } };
  assert.equal(homeCard(doctor, content, '2026-11-08', { back: true }), 'clearance');
  assert.equal(homeCard(data, content, '2026-11-08', { back: true }), 'back');
  assert.equal(homeCard(data, content, '2026-11-08'), 'wrapup');
  assert.equal(homeCard(data, content, '2026-11-11'), null);
});
