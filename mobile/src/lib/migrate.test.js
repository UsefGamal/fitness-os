// The upgrade path (E2-S1, E2-S2, E2-S5, E2-S6, E2-S7). Fixtures are in
// fixtures/. golden-v1-numbers.json was made by running the app's code as
// it was before v2 (main at d16752c) on the v1 fixtures, so "zero diff"
// here means: after the upgrade, every number Yusuf sees for 14 days is
// what the old app showed.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';

import { emptyData } from './data.js';
import { ImportError, parseDataFile, parseSnapshot, toDataFile } from './dataFile.js';
import * as D from './data.js';
import { macroTargets, profileOf, saveProfile } from './macros.js';
import { mealDayNumber } from './meals.js';
import { CURRENT_SCHEMA, migrate, needsMigration, NewerSchemaError, schemaOf, V1_PROFILE_DEFAULTS } from './migrate.js';
import { activePlan } from './plan.js';
import { effectiveDay } from './planEdit.js';
import { plannedReminders } from './reminders.js';
import { programDayFor, sessionKeyOn, weekView } from './schedule.js';
import { content } from './testContent.js';
import { widgetDays } from './widget.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const v1 = (name) => JSON.parse(fixture(`${name}.json`));
const GOLDEN = JSON.parse(fixture('golden-v1-numbers.json'));
// Phase 12 (E3-S1..S3) changed the targets on purpose: protein and fat from
// goal weight, the safe-deficit caps, and Yusuf's goal date moved to 15 Mar.
// golden-phase12-numbers.json is that new truth, approved by Yusuf as a
// before/after diff. Regenerate it with UPDATE_GOLDEN=1 npm test, and only
// with a reason in the PR.
const GOLDEN_FILE = new URL('./fixtures/golden-phase12-numbers.json', import.meta.url);
const NAMES = ['v1-empty', 'v1-yusuf-like', 'v1-oldsite-export'];

/** The numbers with the targets taken out: what phase 12 must not change. */
function withoutTargets(days) {
  return days.map(({ macros: _m, widget, ...rest }) => ({ ...rest, widget: widget && widget.map(({ stats: _s, ...w }) => w) }));
}

/** The same numbers golden-v1-numbers.json holds, from today's code. */
function numbers(data) {
  const T = activePlan(data, content);
  const C = { ...content, training: T };
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(2026, 10, 8 + i, 12);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const moves = data.session_moves || [];
  return dates.map((iso) => {
    const key = sessionKeyOn(iso, T, moves);
    const next = programDayFor(iso, T, moves);
    const day = effectiveDay(next.key, T, data);
    return {
      date: iso,
      macros: macroTargets(data, content.nutrition, iso),
      key,
      next: [next.key, next.onDate],
      exercises: day.exercises.map((e) => [e.name, e.sets, e.reps, e.rest]),
      edited: day.edited,
      week: weekView(iso, T, moves).map((w) => w.label),
      mealDay: mealDayNumber(iso, content.nutrition),
      streak: D.trainingStreak(data, iso, (d) => sessionKeyOn(d, T, moves) === 'rest'),
      widget: iso === '2026-11-08' ? widgetDays(data, content, iso) : null,
      reminders: plannedReminders(iso, C, new Date(`${iso}T05:00:00`), moves, data.evening_plan || {}).length,
    };
  });
}

const upgraded = (name) => (name === 'v1-oldsite-export' ? parseDataFile(fixture(`${name}.json`), content) : migrate(v1(name), content));

test('zero diff: 14 days of plan, meals, streak, widget and reminders match the old app', () => {
  for (const name of NAMES) assert.deepEqual(withoutTargets(numbers(upgraded(name))), withoutTargets(GOLDEN[name]), name);
});

test('targets match the approved phase 12 golden', () => {
  const now = Object.fromEntries(NAMES.map((n) => [n, numbers(upgraded(n))]));
  if (process.env.UPDATE_GOLDEN) writeFileSync(GOLDEN_FILE, `${JSON.stringify(now)}\n`);
  const golden = JSON.parse(readFileSync(GOLDEN_FILE, 'utf8'));
  for (const n of NAMES) assert.deepEqual(now[n], golden[n], n);
});

test('the golden really covers real numbers, not just fallbacks', () => {
  const g = GOLDEN['v1-yusuf-like'];
  assert.equal(g[0].macros.source, 'profile');
  assert.ok(g.some((d) => d.edited), 'an edited plan day is in the window');
  assert.ok(g.some((d) => d.key === 'rest') && g.some((d) => d.key !== 'rest'));
  assert.equal(GOLDEN['v1-oldsite-export'][0].macros.source, 'profile');
  assert.equal(GOLDEN['v1-empty'][0].macros.source, 'plan');
});

test('v1 to v2 adds every new field in one bump', () => {
  const d = migrate(v1('v1-yusuf-like'), content);
  assert.equal(d.schemaVersion, 2);
  assert.equal('version' in d, false);
  assert.equal('plan_overrides' in d, false);
  // Profile: body facts, with the old defaults it was using, plus new fields.
  for (const k of ['start_weight_kg', 'goal_weight_low_kg', 'goal_weight_high_kg', 'goal_date']) assert.equal(k in d.profile, false, k);
  assert.equal(d.profile.height_cm, V1_PROFILE_DEFAULTS.height_cm);
  assert.equal(d.profile.week_start, 'sun');
  assert.equal(d.profile.locale, 'en');
  // The goal moved to goals[], with direction and ended_on.
  assert.deepEqual(d.goals, [{ id: 'g1', set_on: '2026-09-01', direction: 'lose', start_weight_kg: 103, target_low_kg: 75, target_high_kg: 80, target_date: '2027-03-15', rate_pct_bw_wk: null, ended_on: null }]);
  // Safety gates (flags only) and the hide switches, all off.
  assert.deepEqual(Object.values(d.safety.gates), [false, false, false, false, false]);
  assert.equal(d.safety.hide_kcal, false);
  assert.equal(d.safety.hide_weight, false);
  assert.deepEqual(d.diet, { mode: 'plan', plan_start_date: '2026-09-01', ramadan: { from: null, to: null } });
  assert.deepEqual(d.checkins, []);
  assert.deepEqual(d.rewards, { ledger: [] });
  // The plan block owns a copy of the sessions, schedule and the edits.
  const b = d.program.blocks[0];
  assert.equal(d.program.active_block, 'b1');
  assert.equal(b.started_on, '2026-09-01');
  assert.deepEqual(b.sessions, content.training.program);
  assert.deepEqual(b.schedule, content.training.trainer_plan.schedule);
  assert.equal(b.overrides.lower[0].sets, 4);
  // Workouts and sets get block_id, rir and is_warmup.
  const gym = d.workouts.find((w) => w.workout_type === 'gym');
  assert.equal(gym.block_id, 'b1');
  assert.equal(d.workouts.find((w) => w.workout_type === 'padel').block_id, null);
  assert.deepEqual([gym.sets[0].rir, gym.sets[0].is_warmup], [null, false]);
});

test('unknown keys and later v1 fields survive the upgrade and a backup', () => {
  const d = migrate(v1('v1-yusuf-like'), content);
  assert.deepEqual(d.a_key_from_the_future, { kept: true });
  for (const k of ['session_moves', 'exercise_notes', 'achievements', 'evening_plan', 'progress_photos', 'health_daily']) assert.ok(d[k], k);
  const back = parseDataFile(toDataFile(d), content);
  assert.deepEqual(back, d);
});

test('migrating twice is the same as once, and current data is left alone', () => {
  for (const name of ['v1-empty', 'v1-yusuf-like']) {
    const once = migrate(v1(name), content);
    assert.deepEqual(migrate(once, content), once);
    assert.equal(migrate(once, content), once);
  }
  const fresh = emptyData(content);
  assert.equal(needsMigration(fresh), false);
  assert.equal(migrate(fresh, content), fresh);
});

test('a new install gets no one else\'s profile', () => {
  const d = migrate(v1('v1-empty'), content);
  assert.equal(d.profile, null);
  assert.deepEqual(d.goals, []);
  assert.deepEqual(profileOf(emptyData(content)), {});
  // Logging a weight without a profile keeps the plan's band, not Yusuf's numbers.
  const logged = D.logBody(emptyData(content), { log_date: '2026-11-04', weight_kg: 70 });
  assert.equal(macroTargets(logged, content.nutrition, '2026-11-04').source, 'plan');
});

test('the schema version is read from either field', () => {
  assert.equal(schemaOf({ version: 1 }), 1);
  assert.equal(schemaOf({ schemaVersion: 2 }), 2);
  assert.equal(schemaOf({}), 1);
  assert.equal(schemaOf(null), 1);
  assert.equal(CURRENT_SCHEMA, 2);
});

test('a newer schema is refused, never guessed at', () => {
  assert.throws(() => migrate({ schemaVersion: 3 }, content), NewerSchemaError);
  assert.throws(() => parseDataFile(fixture('v3-future.json'), content), (e) => e instanceof ImportError && /Update the app first/.test(e.message));
});

test('a truncated or broken file is refused with nothing returned', () => {
  assert.throws(() => parseDataFile(fixture('corrupt-truncated.json'), content), ImportError);
  assert.throws(() => parseDataFile('[]', content), ImportError);
  assert.throws(() => parseSnapshot(fixture('corrupt-truncated.json'), content), ImportError);
  assert.throws(() => parseSnapshot('7', content), ImportError);
});

test('a v1 snapshot is upgraded when restored, a v2 one is kept as is', () => {
  const fromV1 = parseSnapshot(fixture('v1-yusuf-like.json'), content);
  assert.deepEqual(fromV1, migrate(parseDataFile(JSON.stringify({ ...v1('v1-yusuf-like'), format: 'fitness-os-export' }), content), content));
  const current = migrate(v1('v1-yusuf-like'), content);
  assert.deepEqual(parseSnapshot(JSON.stringify({ ...current, saved_at: 5 }), content), current);
});

test('the Profile form saves body facts and the goal separately', () => {
  let d = migrate(v1('v1-yusuf-like'), content);
  const form = { ...profileOf(d), height_cm: 175, goal_date: '2027-03-15' };
  d = saveProfile(d, form, '2026-11-09');
  assert.equal(d.profile.height_cm, 175);
  assert.equal('goal_date' in d.profile, false);
  assert.equal(d.goals.length, 1);
  assert.equal(d.goals[0].target_date, '2027-03-15');
  assert.equal(profileOf(d).goal_date, '2027-03-15');
  // With no goal yet, the first save creates one.
  const fresh = saveProfile(emptyData(content), { height_cm: 160, gender: 'female', date_of_birth: '1996-05-01', activity_level: 'light', goal_weight_low_kg: 58, goal_weight_high_kg: 60, goal_date: '2027-06-01', start_weight_kg: null }, '2026-11-09');
  assert.deepEqual(fresh.goals.map((g) => [g.id, g.set_on, g.target_low_kg]), [['g1', '2026-11-09', 58]]);
  // An ended goal isn't the current one.
  const ended = { ...fresh, goals: [{ ...fresh.goals[0], ended_on: '2026-12-01' }] };
  assert.equal(profileOf(ended).goal_date, undefined);
});
