// The upgrade path (E2-S1, E2-S2, E2-S5, E2-S6, E2-S7). Fixtures are in
// fixtures/. golden-v1-numbers.json was made by running the app's code as
// it was before v2 (main at d16752c) on the v1 fixtures, so "zero diff"
// here means: after the upgrade, every number Yusuf sees for 14 days is
// what the old app showed.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';

import { bigFixture } from '../../e2e/bigFixture.mjs';
import { emptyData, isWorkSet, personalBests } from './data.js';
import { dataHash } from './dataCheck.js';
import { ImportError, parseDataFile, parseSnapshot, summarize, toDataFile } from './dataFile.js';
import * as D from './data.js';
import { macroTargets, profileOf, saveProfile } from './macros.js';
import { mealDayNumber } from './meals.js';
import { CURRENT_SCHEMA, migrate, needsMigration, NewerSchemaError, schemaOf, v2ToV3, V1_PROFILE_DEFAULTS } from './migrate.js';
import { SET_DEFAULTS, SET_FIELDS, setFields, setWith } from './sets.js';
import { activePlan } from './plan.js';
import { effectiveDay } from './planEdit.js';
import { plannedReminders } from './reminders.js';
import { defaultTimes } from './times.js';
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

/** The numbers with the targets taken out: what phase 12 must not change.
 * FIT-1 fits the meal portions to the target, so the widget's meal text
 * is a target too (the old-site person, at 2,105 kcal, gets bigger
 * portions; Yusuf, at 1,939, gets the plan as written). */
function withoutTargets(days) {
  return days.map(({ macros: _m, widget, ...rest }) => ({
    ...rest,
    widget: widget && widget.map(({ stats: _s, meals, ...w }) => ({ ...w, meals: meals.map(({ what: _w, protein: _p, ...m }) => m) })),
  }));
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
      // The golden predates opt-in meal reminders (P14-12), so it counts them on.
      reminders: plannedReminders(iso, C, new Date(`${iso}T05:00:00`), moves, data.evening_plan || {}, { ...defaultTimes(C), remind_meals: true }).length,
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
  assert.equal(d.schemaVersion, CURRENT_SCHEMA);
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
  // Import keeps it too, in the _unknown bag (P14-10), and nothing else changes.
  const back = parseDataFile(toDataFile(d), content);
  const { a_key_from_the_future: future, ...rest } = d;
  assert.deepEqual(back, { ...rest, _unknown: { a_key_from_the_future: future } });
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
  assert.equal(CURRENT_SCHEMA, 3);
});

test('a newer schema is refused, never guessed at', () => {
  assert.throws(() => migrate({ schemaVersion: 4 }, content), NewerSchemaError);
  assert.throws(() => parseDataFile(fixture('v4-future.json'), content), (e) => e instanceof ImportError && /Update the app first/.test(e.message));
});

test('a truncated or broken file is refused with nothing returned', () => {
  assert.throws(() => parseDataFile(fixture('corrupt-truncated.json'), content), ImportError);
  assert.throws(() => parseDataFile('[]', content), ImportError);
  assert.throws(() => parseSnapshot(fixture('corrupt-truncated.json'), content), ImportError);
  assert.throws(() => parseSnapshot('7', content), ImportError);
});

test('a v1 snapshot is upgraded when restored, a current one is kept as is', () => {
  const fromV1 = parseSnapshot(fixture('v1-yusuf-like.json'), content);
  assert.deepEqual(fromV1, migrate(parseDataFile(JSON.stringify({ ...v1('v1-yusuf-like'), format: 'fitness-os-export' }), content, { trusted: true }), content));
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

// ── Data version 3 (V3): six optional set fields ─────────────────────

const v2 = (name) => JSON.parse(fixture(`${name}.json`));
const V2 = ['v2-yusuf-like', 'v2-friend'];

test('one fixture per released data shape, and each really is that version', () => {
  for (const name of V2) assert.equal(schemaOf(v2(name)), 2, name);
  // The v2 Yusuf fixture is exactly what the v1 one became under version 2.
  // (The plan block is left out: it is a copy of the plan content of the
  // day the fixture was made, and the content is free to change.)
  const { schemaVersion: _a, program: _p, ...fromV1 } = migrate(v1('v1-yusuf-like'), content);
  const { schemaVersion: _b, program: _q, ...saved } = v2('v2-yusuf-like');
  assert.deepEqual(saved, fromV1);
  // The friend fixture holds the shapes that matter: a warm-up, and sets
  // as the CSV import wrote them (no rir, no is_warmup).
  const sets = v2('v2-friend').workouts.flatMap((w) => w.sets);
  assert.ok(sets.some((s) => s.is_warmup === true));
  assert.ok(sets.some((s) => !('rir' in s) && !('is_warmup' in s)));
});

test('zero diff: v2 to v3 changes the version number and nothing else', () => {
  for (const name of V2) {
    const before = v2(name);
    const after = migrate(structuredClone(before), content);
    assert.equal(after.schemaVersion, 3);
    assert.deepEqual({ ...after, schemaVersion: 2 }, before, name);
    assert.deepEqual(v2ToV3(before), { ...before, schemaVersion: 3 });
    // With the six fields taken off every set, too (there are none to take).
    const bare = { ...after, schemaVersion: 2, workouts: after.workouts.map((w) => ({ ...w, sets: w.sets.map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !SET_FIELDS.includes(k)))) })) };
    assert.deepEqual(bare, before, name);
    assert.equal(migrate(after, content), after, 'twice is once');
    assert.equal(needsMigration(after), false);
  }
});

test('the data check code is the same before and after the upgrade', () => {
  for (const name of V2) {
    const before = v2(name);
    const after = migrate(structuredClone(before), content);
    assert.equal(dataHash(after), dataHash(before), name);
    // Writing every default out in full is still the same data.
    const full = { ...after, workouts: after.workouts.map((w) => ({ ...w, sets: w.sets.map((s) => ({ ...s, ...setFields(s) })) })) };
    assert.equal(dataHash(full), dataHash(before), name);
    // A real drop set is a change.
    const changed = { ...after, workouts: after.workouts.map((w, i) => (i ? w : { ...w, sets: w.sets.map((s, j) => (j ? s : setWith(s, { set_type: 'drop' }))) })) };
    assert.notEqual(dataHash(changed), dataHash(before), name);
  }
});

test('the numbers do not move: records, weekly sets, volume and work sets are the same in v2 and v3', () => {
  for (const name of V2) {
    const before = v2(name);
    const after = migrate(structuredClone(before), content);
    assert.deepEqual(personalBests(after), personalBests(before), name);
    assert.deepEqual(after.workouts.map((w) => w.sets.map(isWorkSet)), before.workouts.map((w) => w.sets.map(isWorkSet)), name);
    assert.deepEqual(summarize(after), summarize(before), name);
  }
  // The warm-up in the friend fixture is still not a work set, and reads as one.
  const friend = migrate(v2('v2-friend'), content);
  const warm = friend.workouts.flatMap((w) => w.sets).find((s) => s.is_warmup);
  assert.equal(isWorkSet(warm), false);
  assert.equal(setFields(warm).set_type, 'warmup');
});

test('round trip: a v3 export with real set fields imports back the same', () => {
  for (const name of V2) {
    let d = migrate(v2(name), content);
    d = { ...d, workouts: d.workouts.map((w, i) => (i ? w : { ...w, sets: w.sets.map((s, j) => (j === 0 ? setWith(s, { set_type: 'drop', group: 'A' }) : j === 1 ? setWith(s, { track: 'bodyweight', added_kg: -20 }) : j === 2 ? setWith(s, { track: 'time', duration_s: 90, distance_m: 400 }) : s)) })) };
    const back = parseDataFile(toDataFile(d), content);
    assert.equal(back.schemaVersion, 3);
    assert.deepEqual(back.workouts, d.workouts, name);
    assert.equal(dataHash(back), dataHash(d), name);
  }
});

test('a v2 backup still imports, and comes out as version 3', () => {
  for (const name of V2) {
    const file = JSON.stringify({ format: 'fitness-os-export', ...v2(name) });
    const back = parseDataFile(file, content);
    assert.equal(back.schemaVersion, 3);
    assert.deepEqual(summarize(back), summarize(v2(name)), name);
    assert.equal(dataHash(back), dataHash(v2(name)), name);
  }
});

test('import fuzz: a bad set field is dropped to its default, never trusted', () => {
  const base = migrate(v2('v2-friend'), content);
  const bad = [
    { set_type: 'mega', group: 'A'.repeat(9), track: 'vibes', added_kg: 1e9, distance_m: -5, duration_s: 86401 },
    { set_type: 7, group: 42, track: null, added_kg: '20', distance_m: 12.5, duration_s: '90' },
    { set_type: ['drop'], group: { a: 1 }, track: {}, added_kg: Number.NaN, distance_m: 1e12, duration_s: -1 },
    { set_type: 'x'.repeat(5000), group: '', track: 'LOAD', added_kg: -201, distance_m: 100001, duration_s: 1.5 },
    { set_type: '__proto__', group: '<script>alert(1)</script>', track: 'constructor', added_kg: Infinity, distance_m: null, duration_s: true },
  ];
  for (const fields of bad) {
    const d = { ...base, workouts: base.workouts.map((w) => ({ ...w, sets: w.sets.map((s) => ({ ...s, ...fields })) })) };
    // JSON has no NaN or Infinity; they arrive as null, which is the default.
    const back = parseDataFile(toDataFile(d), content);
    for (const s of back.workouts.flatMap((w) => w.sets)) {
      for (const k of SET_FIELDS) assert.equal(k in s, false, `${k}: ${JSON.stringify(fields[k])}`);
      assert.deepEqual(setFields(s), { ...SET_DEFAULTS, set_type: s.is_warmup ? 'warmup' : 'work' });
    }
    assert.equal(dataHash(back), dataHash(base));
  }
  // Good values at the edges are kept.
  const edge = { set_type: 'failure', group: 'ABCDEFGH', track: 'distance', added_kg: -200, distance_m: 100000, duration_s: 86400 };
  const d = { ...base, workouts: base.workouts.map((w) => ({ ...w, sets: w.sets.map((s) => ({ ...s, ...edge })) })) };
  for (const s of parseDataFile(toDataFile(d), content).workouts.flatMap((w) => w.sets)) assert.deepEqual(setFields(s), edge);
  // A set that is not a record at all is dropped, as before.
  const junk = { ...base, workouts: base.workouts.map((w, i) => (i ? w : { ...w, sets: [...w.sets, null, 'set', 7] })) };
  assert.equal(summarize(parseDataFile(toDataFile(junk), content)).sets, summarize(base).sets);
});

test('the three-year file is no bigger in version 3', () => {
  const big = migrate(bigFixture('2026-11-06', 3), content);
  assert.equal(big.schemaVersion, 3);
  assert.equal(big.workouts.flatMap((w) => w.sets).some((s) => SET_FIELDS.some((k) => k in s)), false);
});
