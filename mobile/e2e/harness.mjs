// Phone harness (E6-S8). Opens every route of the built app at 360, 390 and
// 412 px wide, left-to-right and right-to-left, with a Yusuf-like data file,
// and counts per route:
//   axe      WCAG 2 A/AA problems from axe-core (contrast included)
//   taps     buttons, links and fields smaller than 44 x 44 px
//   overflow pages that scroll sideways
// Like the i18n lint, the counts may only go down: e2e/baseline.json holds
// today's numbers and a PR that raises one fails.
//
//   npm run e2e                 build, then check against the baseline
//   node e2e/harness.mjs --update   record the current counts
//   node e2e/harness.mjs --shots    also save screenshots to e2e/out/
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { availableParallelism } from 'node:os';

import { chromium } from 'playwright';

import en from '../src/i18n/en.js';
import { SCREENED } from './bigFixture.mjs';
import { harnessPerson } from './harnessPerson.mjs';
import { addExercise, createSession } from '../src/lib/myRoutine.js';
import { fillSet, kgCell } from './setPick.mjs';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const HERE = new URL('.', import.meta.url);
const BASELINE = new URL('./baseline.json', HERE);
// TEST-1 part B: today's data shape (saved foods, water goal, safety, a
// week of meals), built from the v1 fixture through the real upgrade.
const FIXTURE = harnessPerson();
const KEY = 'fitness-os-data-v1';
// Every run sees the same day, so a screen's numbers don't move with the
// calendar (a Saturday meal day vs a Friday rest day). Friday 6 Nov 2026,
// 09:00 in Cairo: the day the baselines were recorded.
const NOW = new Date('2026-11-06T07:00:00Z');
const SUNDAY = new Date('2026-11-08T07:00:00Z');
const AFTERNOON = new Date('2026-11-06T12:00:00Z');
const PORT = 4179;

export const ROUTES = ['/', '/plan', '/plan/routines', '/plan/mine', '/workout', '/meals', '/stats', '/history', '/library', '/settings', '/settings/data', '/settings/training', '/settings/times', '/settings/prefs', '/settings/about', '/settings/install', '/settings/help', '/settings/privacy', '/shopping', '/quests', '/profile', '/snapshots', '/photos', '/intervals', '/session/home', '/session/recovery'];
export const WIDTHS = [360, 390, 412];
export const DIRS = ['ltr', 'rtl'];
export const MIN_TAP = 44;
// A Samsung A55 on Android 15+ draws edge to edge: about 32 px of status bar
// and 48 px of 3-button nav bar sit over the page. Chromium reports 0 for
// env(safe-area-inset-*), so every screen runs with these insets put in
// --sat / --sab instead, and the `bars` check looks at what lands under them.
export const INSETS = { top: 32, bottom: 48 };
const INSET_CSS = `:root{--sat:${INSETS.top}px!important;--sab:${INSETS.bottom}px!important}`;
const withInsets = (ctx) => ctx.addInitScript((css) => {
  const put = () => { const s = document.createElement('style'); s.dataset.insets = ''; s.textContent = css; document.head.append(s); };
  if (document.head) put(); else document.addEventListener('DOMContentLoaded', put);
}, INSET_CSS);
export const STATE_WIDTHS = [360, 412];

const btnNamed = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' });
const restWeek = (d) => ({ ...d, program: { ...d.program, blocks: d.program.blocks.map((b) => ({ ...b, schedule: b.schedule.map((x) => ({ ...x, session: 'rest', cardio_after: null })) })) } });
const fasting = (d) => ({ ...d, diet: { ...d.diet, ramadan: { from: '2026-11-01', to: '2026-11-29', iftar: '17:00', suhoor: '04:30' } } });
const afterEid = (d) => ({ ...d, diet: { ...d.diet, ramadan: { from: '2026-10-05', to: '2026-11-03', iftar: '17:00', suhoor: '04:30' } } });
// FIRST-1: set up two days ago, no workout finished, nothing backed up.
const firstWeek = (d) => ({ ...d, setup: { ...(d.setup || {}), done_on: '2026-11-04' }, workouts: d.workouts.filter((w) => !w.finished_at), settings: { ...d.settings, last_backup_at: null, auto_backup: undefined, first_week: undefined, tour: { done_on: '2026-11-04' } } });
// UIUX-2: the biggest text size.
const bigText = (d) => ({ ...d, settings: { ...d.settings, text_size: 130 } });
// UIUX-4: gym mode switched on.
// A finished session two days back with every exercise in it, so the set
// table shows its "last: 50 × 6" line under each row (the 27 Nov screenshot).
const doneBefore = (d) => ({ ...d, workouts: [...d.workouts, { id: 9001, log_date: '2026-11-04', workout_type: 'strength', duration_min: 60, notes: 'Earlier', session_rpe: 7, is_deload: false, pain_note: null, result: null, session_key: null, started_at: null, finished_at: Date.parse('2026-11-04T08:00:00Z'), checklist_items: [], sets: d.exercises.flatMap((x, i) => [1, 2, 3].map((n) => ({ id: 90000 + i * 3 + n, exercise_id: x.id, set_number: n, reps: 6, weight_kg: 50, rpe: 8 }))) }] });
const gymOn = (d) => ({ ...d, settings: { ...d.settings, training: { ...d.settings?.training, gym_mode: true } } });
// MAINT-1: the goal range is where the weight already is; then the second
// week of maintenance after it.
const goalReached = (d) => ({ ...d, goals: d.goals.map((g) => (g.ended_on ? g : { ...g, target_low_kg: 94, target_high_kg: 97 })) });
const maintaining = (d) => ({ ...d, goals: [...d.goals.map((g) => ({ ...g, ended_on: g.ended_on || '2026-10-30' })), { id: 'gm', set_on: '2026-10-30', direction: 'maintain', start_weight_kg: 95, target_low_kg: 94, target_high_kg: 96, target_date: null, ended_on: null, reverse: { from_kcal: 1940, started_on: '2026-10-30', step: 150, weeks: 6 } }] });
// TARGET-1: three flat weeks with every meal ticked, then after "Lower".
const flatWeeks = (d) => {
  const slots = [...new Set(d.meal_logs.map((m) => m.meal_slot))];
  const day = (i) => new Date(Date.UTC(2026, 10, 6 - i)).toISOString().slice(0, 10);
  const logs = Array.from({ length: 28 }, (_, i) => ({ id: 9000 + i, log_date: day(i), weight_kg: 95 }));
  const meals = Array.from({ length: 21 }, (_, i) => slots.map((s, j) => ({ id: 9100 + i * 10 + j, log_date: day(i), meal_slot: s, option_key: 'option_a', completed: true }))).flat();
  // A slower goal than the fixture's own, so the target is under the 25% cap and a cut can still be offered.
  return { ...d, body_logs: logs, meal_logs: meals, goals: d.goals.map((g) => (g.ended_on ? g : { ...g, set_on: '2026-09-01', target_date: '2028-06-01' })) };
};
const adjusted = (d) => ({ ...d, goals: d.goals.map((g) => (g.ended_on ? g : { ...g, kcal_adjust: [{ on: '2026-11-01', kcal: -150 }] })) });
const lightTheme = (d) => ({ ...d, settings: { ...d.settings, theme: 'light' } });
const eightWeeks = (d) => {
  const id = d.program?.active_block;
  const blocks = (d.program?.blocks || []).map((b) => (b.id === id ? { ...b, started_on: '2026-09-01', template_id: b.template_id || 'starter-3' } : b));
  const extra = Array.from({ length: 8 }, (_, i) => ({ id: 9000 + i, log_date: `2026-09-${String(2 + i * 3).padStart(2, '0')}`, workout_type: 'gym', started_at: null, finished_at: `2026-09-${String(2 + i * 3).padStart(2, '0')}T08:00:00`, sets: [], block_id: id }));
  return { ...d, program: { ...d.program, blocks }, workouts: [...extra, ...d.workouts.map((w) => ({ ...w, block_id: id }))] };
};
const gated = (d) => ({ ...d, safety: { ...SCREENED, gates: { ...SCREENED.gates, no_deficit: true, protein_cap: true, beginner_only: true, needs_clearance: true } } });
const trainedFriday = (d) => ({ ...d, workouts: [...d.workouts, { ...d.workouts[0], id: 9999, log_date: '2026-11-06', started_at: null, finished_at: '2026-11-06T08:00:00', sets: [] }] });
const toFullMeals = async (page) => {
  const full = btnNamed(page, en['mealsSimple.toPlan']);
  if (await full.count()) await full.click();
};

/** Start today's session on /workout (or the first one on a rest day). */
const startSession = async (p) => {
  // A rest day (the starting plan rests on this Friday) asks for a session first.
  if (!(await p.getByRole('button', { name: /^Start / }).count())) await p.locator('.list').last().locator('a, button').first().click();
  await p.waitForTimeout(500);
  const start = p.getByRole('button', { name: /^Start / }).first();
  if (await start.count()) await start.click();
  await kgCell(p).first().waitFor();
};

/** TEST-1 part B: sheets and states a route alone never shows. Each runs
 * at 360 and 412 px, left to right, with the same checks as the routes.
 * Not here: the permissions sheet (only on a phone) and DaySheet (no
 * screen opens it today). */
export const STATES = [
  { name: 'sheet: weigh-in', route: '/', act: (p) => btnNamed(p, new RegExp(`${en['home.weightLog']}|${en['home.weightFirst']}`)).first().click() },
  { name: 'sheet: ate something else', route: '/meals', act: async (p) => { await toFullMeals(p); await btnNamed(p, en['other.open']).first().click(); } },
  { name: "sheet: what's new", route: '/settings/about', act: (p) => p.getByRole('button', { name: new RegExp(`^${en['whatsNew.title']}`) }).first().click() },
  { name: 'settings: search', route: '/settings', act: async (p) => { await p.getByRole('button', { name: en['settings.search'] }).click(); await p.getByRole('searchbox').fill('rest'); } },
  { name: 'settings: training all open', route: '/settings/training', act: async (p) => { for (const k of ['set.equipExp', 'set.soundsVib', 'set.advanced']) await p.getByRole('button', { name: en[k] }).click(); } },
  { name: 'sheet: rest time', route: '/settings/training', act: (p) => p.getByRole('button', { name: new RegExp(`^${en['set.restBig']}`) }).click() },
  { name: 'sheet: export CSV', route: '/settings/data', act: (p) => p.getByRole('button', { name: new RegExp(`^${en['set.exportCsv']}`) }).click() },
  { name: 'library: by muscle', route: '/library', act: (p) => p.getByRole('button', { name: 'All with photos' }).click() },
  { name: 'library: one group', route: '/library', act: async (p) => { await p.getByRole('button', { name: 'All with photos' }).click(); await p.getByRole('button', { name: 'Shoulders', exact: true }).click(); } },
  // BeFit item 10: Swap by muscle (the chips work without the catalogue).
  {
    name: 'sheet: swap by muscle',
    route: '/workout',
    act: async (p) => {
      await startSession(p);
      await p.locator('.tbtn[aria-haspopup="dialog"]').first().click();
      await btnNamed(p, en['workout.swap']).click();
      await p.locator('.sheet .chip-btn').nth(2).click();
    },
  },
  { name: 'plan: another day picked', route: '/plan', act: (p) => p.locator('.week-day').nth(0).click() },
  { name: 'stats: recovery by group', route: '/stats?tab=muscles', act: (p) => p.getByRole('button', { name: 'Recovery' }).click() },
  { name: 'stats: body', route: '/stats?tab=body' },
  { name: 'stats: badges', route: '/stats?tab=badges' },
  { name: 'stats: weigh-in history', route: '/stats/body/weigh-ins' },
  { name: 'stats: body measurements', route: '/stats/body/measurements' },
  { name: 'sheet: more menu', route: '/plan', act: (p) => btnNamed(p, en['more.label']).first().click() },
  {
    name: 'sheet: swap similar',
    route: '/plan/mine/my_1',
    data: (d) => {
      const made = createSession(d, 'Chest day').data;
      return addExercise(addExercise(made, 'my_1', { name: 'Bench Press', group: 'Chest', equipment: 'barbell' }), 'my_1', { name: 'Push-Up', group: 'Chest', equipment: 'bodyweight' });
    },
    act: (p) => p.getByRole('button', { name: /^Swap .* for a similar exercise$/ }).first().click(),
  },
  {
    name: 'sheet: finish summary',
    route: '/workout',
    act: async (p) => {
      await startSession(p);
      await fillSet(p, 20);
      await btnNamed(p, en['workout.logSet'].replace('{n}', 1)).click();
      await btnNamed(p, en['workout.finishWorkout']).click();
      await p.getByRole('button', { name: new RegExp(`^(${en['workout.save']}|${en['workout.saveShort']})$`) }).click();
      await p.getByRole('heading', { name: en['finish.title'] }).waitFor({ timeout: 5000 });
    },
  },
  // Design laws plan #1: a logged set's tick opens this sheet, never a delete.
  {
    name: 'sheet: edit a logged set',
    route: '/workout',
    act: async (p) => {
      await startSession(p);
      await fillSet(p, 20);
      await btnNamed(p, en['workout.logSet'].replace('{n}', 1)).click();
      await btnNamed(p, en['workout.editSet'].replace('{n}', 1)).click();
      await p.getByRole('button', { name: en['setEdit.delete'] }).waitFor({ timeout: 5000 });
    },
  },
  // The next set's weight and reps as rulers (SetPicker).
  {
    name: 'sheet: set rulers',
    route: '/workout',
    act: async (p) => {
      await startSession(p);
      await kgCell(p).first().click();
      await p.getByRole('dialog').getByRole('spinbutton', { name: /^Weight for set \d+, in kg$/ }).waitFor();
    },
  },
  // Design laws plan #7: the bottom bar and the finish sheet.
  {
    name: 'workout: log bar after a set',
    route: '/workout',
    act: async (p) => {
      await startSession(p);
      await fillSet(p, 20);
      await btnNamed(p, en['workout.logSet'].replace('{n}', 1)).click();
      await p.locator('.log-bar').waitFor({ timeout: 5000 }).catch(() => {});
    },
  },
  // The rest after a set, in gym mode (no tab bar, so the nav bar sits right
  // under the timer), as the bar and opened full screen.
  {
    name: 'gym mode: resting after a set',
    route: '/workout',
    data: (d) => gymOn(doneBefore(d)),
    act: async (p) => {
      await startSession(p);
      await btnNamed(p, en['workout.logSet'].replace('{n}', 1)).click();
      await p.locator('.timer, .timer-pill').first().waitFor({ timeout: 5000 });
    },
  },
  {
    name: 'gym mode: rest full screen',
    route: '/workout',
    data: (d) => gymOn(doneBefore(d)),
    act: async (p) => {
      await startSession(p);
      await btnNamed(p, en['workout.logSet'].replace('{n}', 1)).click();
      await p.locator('.timer-open').click({ timeout: 5000 });
      await p.locator('.timer-full').waitFor();
    },
  },
  {
    name: 'sheet: finish a workout',
    route: '/workout',
    act: async (p) => {
      await startSession(p);
      await fillSet(p, 20);
      await btnNamed(p, en['workout.logSet'].replace('{n}', 1)).click();
      await btnNamed(p, en['workout.finishWorkout']).click();
      await p.getByRole('radiogroup', { name: en['finish.effort'] }).waitFor({ timeout: 5000 });
    },
  },
  { name: 'empty week on Plan', route: '/plan', data: restWeek },
  // BACK-1: the last workout 11 days ago; and the session time long gone
  // (the starting plan rests on Fridays, so a session is put on it).
  { name: 'welcome back on Home', route: '/', data: (d) => ({ ...d, workouts: d.workouts.filter((w) => w.log_date <= '2026-10-26') }), check: (p) => p.getByText(en['back.title']).waitFor() },
  { name: 'missed yesterday on Home', route: '/', data: (d) => ({ ...d, workouts: d.workouts.filter((w) => w.log_date < '2026-11-05'), session_moves: [{ from: null, to: '2026-11-05', key: 'full_a' }, { from: null, to: '2026-11-06', key: 'rest' }] }), check: (p) => p.getByRole('button', { name: en['missed.today'] }).waitFor() },
  { name: 'still time today on Home', route: '/', now: AFTERNOON, data: (d) => ({ ...d, workouts: d.workouts.filter((w) => w.log_date < '2026-11-06'), session_moves: [{ from: null, to: '2026-11-06', key: 'full_a' }] }), check: (p) => p.getByText(en['still.title']).first().waitFor() },
  // WRAP-1: Sunday, the week that ended on Saturday (trained Friday, so
  // it isn't a welcome back).
  { name: 'wrap-up card on Home', route: '/', now: SUNDAY, data: trainedFriday, check: (p) => p.getByRole('button', { name: new RegExp(en['wrap.open']) }).waitFor() },
  { name: 'sheet: your week', route: '/', now: SUNDAY, data: trainedFriday, act: (p) => p.getByRole('button', { name: new RegExp(en['wrap.open']) }).click() },
  { name: 'beginner: session 1 of 6', route: '/', data: (d) => ({ ...d, workouts: [], settings: { ...d.settings, training: { ...d.settings?.training, level: 'beginner' } } }) },
  { name: 'quests off: Home', route: '/', data: (d) => ({ ...d, settings: { ...d.settings, modules: { ...d.settings?.modules, quests: false } } }) },
  { name: 'safety limits on: Home', route: '/', data: gated },
  {
    name: 'sheet: kind of set',
    route: '/workout',
    act: async (p) => {
      await startSession(p);
      await fillSet(p, 20);
      await btnNamed(p, en['workout.logSet'].replace('{n}', 1)).click();
      await p.getByRole('button', { name: new RegExp(`^1: set 1, ${en['setType.work']}`) }).click();
      // In the sheet: the workout's own Drop set button has the same words.
      await p.getByRole('dialog').getByRole('button', { name: new RegExp(en['setType.drop']) }).click();
      await p.getByRole('button', { name: new RegExp(`^D: set 1, ${en['setType.drop']}`) }).click();
      await p.getByText(en['setType.failureNote']).waitFor({ timeout: 5000 });
    },
  },
  {
    name: 'help: an answer open',
    route: '/settings/help',
    act: async (p) => { await p.getByText(en['help.update.q']).click(); await p.getByText(en['help.update.a']).waitFor({ timeout: 5000 }); },
  },
  {
    name: 'sheet: delete everything',
    route: '/settings/privacy',
    act: async (p) => {
      await btnNamed(p, new RegExp(`^${en['wipe.title']}`)).click();
      await p.getByRole('textbox').fill('DELETE');
    },
  },
  { name: 'first week on Home', route: '/', data: firstWeek, check: (p) => p.getByText(en['first.title']).waitFor() },
  { name: 'sheet: add the widget', route: '/', data: firstWeek, act: (p) => btnNamed(p, en['first.widget']).click() },
  { name: 'text 130%: Plan', route: '/plan', data: bigText },
  { name: 'text 130%: Stats', route: '/stats', data: bigText },
  { name: 'text 130%: Settings', route: '/settings', data: bigText },
  { name: 'light: Home', route: '/', data: lightTheme },
  { name: 'light: Plan', route: '/plan', data: lightTheme },
  { name: 'light: Workout', route: '/workout', data: lightTheme },
  { name: 'light: Meals', route: '/meals', data: lightTheme },
  { name: 'light: Stats', route: '/stats', data: lightTheme },
  { name: 'light: Settings', route: '/settings/modules', data: lightTheme },
  { name: 'light: History', route: '/history', data: lightTheme },
  { name: 'light: Library', route: '/library', data: lightTheme },
  { name: 'check-in card on Plan', route: '/plan', data: eightWeeks, check: (p) => p.getByText(en['checkin.cardTitle']).first().waitFor() },
  { name: 'plan check-in', route: '/plan/checkin', data: eightWeeks, check: (p) => p.getByRole('heading', { name: en['checkin.title'] }).waitFor() },
  { name: 'monday week on Plan', route: '/plan', data: (d) => ({ ...d, profile: { ...d.profile, week_start: 'mon' } }) },
  { name: 'time varies on Home', route: '/', data: (d) => ({ ...d, settings: { ...d.settings, times: { ...d.settings?.times, session_varies: true } } }) },
  { name: 'time varies: settings', route: '/settings/times', data: (d) => ({ ...d, settings: { ...d.settings, times: { ...d.settings?.times, session_varies: true } } }), check: (p) => p.getByText(en['times.varies']).first().waitFor() },
  { name: 'ramadan: Home', route: '/', data: fasting, check: (p) => p.getByText(en['ramadan.chip']).first().waitFor() },
  { name: 'ramadan: Meals', route: '/meals', data: fasting, act: (p) => toFullMeals(p), check: (p) => p.getByText(en['ramadan.meal.breakfast']).first().waitFor() },
  { name: 'ramadan: settings', route: '/settings/times', data: fasting, check: (p) => p.getByText(en['ramadan.from']).first().waitFor() },
  { name: 'after Eid on Home', route: '/', data: afterEid, check: (p) => p.getByText(en['ramadan.afterChip']).first().waitFor() },
  { name: 'safety limits on: Meals', route: '/meals', data: gated },
  // Audit NUT-2: calories hidden means no kcal anywhere in the full plan.
  {
    name: 'calories hidden: full plan',
    route: '/meals',
    data: (d) => ({ ...gated(d), safety: { ...gated(d).safety, hide_kcal: true } }),
    act: toFullMeals,
    check: async (p) => { const text = await p.locator('#root').innerText(); if (/\d\s*kcal/.test(text)) throw new Error(`kcal shown while hidden: ${text.match(/.{0,30}\d\s*kcal.{0,10}/)[0]}`); },
  },
  { name: 'gym mode: last time under each set', route: '/workout', data: (d) => gymOn(doneBefore(d)), act: startSession },
  { name: 'gym mode: logging a set', route: '/workout', data: gymOn, act: startSession, check: async (p) => { if (await p.locator('.tabbar').isVisible()) throw new Error('tab bar still shown in gym mode'); } },
  { name: 'goal reached on Home', route: '/', data: goalReached, check: (p) => p.getByText(en['maint.title']).waitFor() },
  { name: 'maintenance week on Meals', route: '/meals', data: maintaining, act: toFullMeals },
  { name: 'target check on Home', route: '/', data: flatWeeks, check: (p) => p.getByText(en['tcheck.title']).waitFor() },
  { name: 'adjusted target on Meals', route: '/meals', data: adjusted, act: toFullMeals, check: (p) => p.getByRole('button', { name: en['tcheck.undo'] }).waitFor() },
  // UIUX-2: the app's own 130% text size (Settings > Look).
  { name: 'text 130%: Home', route: '/', data: bigText },
  { name: 'text 130%: Workout', route: '/workout', data: bigText },
  // FEEL-1: the set table's tick stays a 44 px target at 360 px and 130% text.
  { name: 'text 130%: logging a set', route: '/workout', data: bigText, act: startSession, floor: { sel: '.st-tick.next', min: 44 } },
  { name: 'text 130%: Meals', route: '/meals', data: bigText, act: toFullMeals },
];

/** Interactive elements under 44 x 44, measured in the page. Inline links
 * inside a sentence are left out (WCAG 2.5.8 exempts them). */
function smallTaps(arg) {
  const { min, detail } = typeof arg === 'number' ? { min: arg, detail: false } : arg;
  const found = [];
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]';
  let n = 0;
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    if (el.tagName === 'A' && style.display === 'inline' && el.parentElement && /\S/.test(el.parentElement.textContent.replace(el.textContent, ''))) continue;
    // A pseudo-element can widen the tap area (see .check::after).
    const after = getComputedStyle(el, '::after');
    const grow = after.content !== 'none' && after.position === 'absolute' ? -parseFloat(after.top || '0') * 2 : 0;
    if (r.width + grow < min || r.height + grow < min) {
      n += 1;
      if (detail) found.push(`${el.tagName.toLowerCase()}.${el.className} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  return detail ? found : n;
}

/** Text or controls drawn over the status bar or nav bar. body::before and
 * body::after are opaque strips under the bars (styles.css); anything in a
 * layer stacked above a strip, while inside its band, collides with the
 * clock or the nav buttons. Also counts a missing strip. */
function barClashes({ top, bottom, detail }) {
  const found = [];
  const strip = (pseudo) => getComputedStyle(document.body, pseudo);
  const before = strip('::before');
  const after = strip('::after');
  if (before.position !== 'fixed' || parseFloat(before.height) < top - 0.5) found.push('no status bar strip');
  if (after.position !== 'fixed' || parseFloat(after.height) < bottom - 0.5) found.push('no nav bar strip');
  const zTop = Number(before.zIndex) || 0;
  const zBottom = Number(after.zIndex) || 0;
  const H = window.innerHeight;
  // The z-index of the outermost positioned ancestor: the layer the element
  // paints in, compared with the strips' layer (both are children of body).
  const layer = (el) => {
    let z = 0;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.position !== 'static' && cs.zIndex !== 'auto') z = Number(cs.zIndex);
    }
    return z;
  };
  const seen = new Set();
  const sel = 'button, a[href], input, select, textarea, [role=button], img, svg';
  const items = [...document.querySelectorAll(sel)];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (/\S/.test(t.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  for (let t = walker.nextNode(); t; t = walker.nextNode()) items.push(t.parentElement);
  for (const el of items) {
    if (!el || seen.has(el)) continue;
    seen.add(el);
    if (el.closest('.sr-only')) continue;
    // Only the part a scrolling box (a sheet's list) actually shows.
    const b = el.getBoundingClientRect();
    const r = { top: b.top, bottom: b.bottom, width: b.width, height: b.height };
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const o = getComputedStyle(n);
      if (o.overflowY === 'visible' && o.overflowX === 'visible') continue;
      const c = n.getBoundingClientRect();
      r.top = Math.max(r.top, c.top);
      r.bottom = Math.min(r.bottom, c.bottom);
    }
    r.height = r.bottom - r.top;
    // Full-screen layers (a sheet's dim backdrop) are meant to run under the bars.
    if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= H || r.height >= H * 0.9) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const inTop = r.top < top - 0.5;
    const inBottom = r.bottom > H - bottom + 0.5;
    if (!inTop && !inBottom) continue;
    const z = layer(el);
    if ((inTop && z >= zTop) || (inBottom && z > zBottom)) {
      found.push(`${inTop ? 'status' : 'nav'} bar: ${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 30)}"`);
    }
  }
  return detail ? found : found.length;
}

/** Controls painting over an outline: a box with an inset ring (box-shadow
 * inset or a border) whose descendants with a background reach into the
 * ring, like the set pickers over the next set's green outline (27 Nov). */
function ringOverlaps(detail) {
  const found = [];
  const opaque = (cs) => cs.backgroundImage !== 'none' || !/[/,]\s*0(\.0+)?\)$|transparent/.test(cs.backgroundColor);
  // The spread (4th length) of each inset shadow; blur is not a ring.
  const spread = (shadow) => Math.max(0, ...shadow.split(/,(?![^(]*\))/).filter((x) => x.includes('inset')).map((x) => Number((x.replace(/rgba?\([^)]*\)|color\([^)]*\)/g, '').match(/-?[\d.]+px/g) || [])[3]?.slice(0, -2) || 0)));
  for (const box of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(box);
    const inset = cs.boxShadow.includes('inset') ? spread(cs.boxShadow) : 0;
    const border = Math.min(...['Top', 'Right', 'Bottom', 'Left'].map((k) => parseFloat(cs[`border${k}Width`]) || 0));
    const ring = Math.max(inset, border);
    if (ring < 1 || cs.display === 'none') continue;
    const r = box.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    for (const kid of box.querySelectorAll('*')) {
      const k = getComputedStyle(kid);
      if (!opaque(k) || k.visibility === 'hidden' || Number(k.opacity) === 0 || k.position === 'fixed') continue;
      if (k.position === 'absolute' && !box.contains(kid.offsetParent)) continue;
      const q = kid.getBoundingClientRect();
      if (q.width < 1 || q.height < 1) continue;
      const into = q.top < r.top + ring - 0.5 || q.bottom > r.bottom - ring + 0.5 || q.left < r.left + ring - 0.5 || q.right > r.right - ring + 0.5;
      if (into) found.push(`${box.tagName.toLowerCase()}.${String(box.className.baseVal ?? box.className).split(' ').join('.')} > ${kid.tagName.toLowerCase()}.${String(kid.className.baseVal ?? kid.className).split(' ')[0]}`);
    }
  }
  return detail ? found : found.length;
}

function stop(child) {
  try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); }
}

async function serve() {
  // Its own process group, so stop() ends vite too and not just npx;
  // otherwise vite keeps the pipe open and node never exits.
  const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: new URL('..', HERE), stdio: 'ignore', detached: true });
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return child; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  stop(child);
  throw new Error('vite preview did not start');
}

/** axe, small taps, sideways overflow and page errors for what is showing. */
async function measure(page, errors, key, shot, floor) {
  await page.addScriptTag({ content: AXE });
  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return r.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }));
  });
  let taps = await page.evaluate(smallTaps, MIN_TAP);
  // A stricter floor for some controls (a state's `floor`), counted as taps.
  if (floor) taps += await page.evaluate(({ sel, min }) => [...document.querySelectorAll(sel)].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.width < min || r.height < min); }).length, floor);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  // The bars check at the top and scrolled halfway, where sticky headers stick.
  let bars = await page.evaluate(barClashes, INSETS);
  const tall = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  if (tall > 100) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(tall / 2));
    await page.waitForTimeout(150);
    bars += await page.evaluate(barClashes, INSETS);
    // And at the very end, where the last control must clear the nav bar.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
    bars += await page.evaluate(barClashes, INSETS);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  const ring = await page.evaluate(ringOverlaps, false);
  // Where, so a CI failure names the element without a re-run.
  const where = {
    ring: ring ? await page.evaluate(ringOverlaps, true) : [],
    bars: bars ? await page.evaluate(barClashes, { ...INSETS, detail: true }) : [],
  };
  const errs = errors.splice(0);
  if (process.env.E2E_VERBOSE) {
    console.log(key, errs.join(' | '));
    if (process.env.E2E_VERBOSE === '2') {
      if (bars) console.log('  bars:', (await page.evaluate(barClashes, { ...INSETS, detail: true })).join('; '));
      if (ring) console.log('  ring:', (await page.evaluate(ringOverlaps, true)).join('; '));
      if (taps) console.log('  taps:', (await page.evaluate(smallTaps, { min: MIN_TAP, detail: true })).join('; '));
      const nodes = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2aa'] } })).violations.flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target.join(' ')} ${n.any[0]?.message?.slice(0, 90) || ''}`)));
      if (nodes.length) console.log('  axe:', nodes.join('\n       '));
    }
  }
  if (shot) {
    mkdirSync(new URL('./out/', HERE), { recursive: true });
    await page.screenshot({ path: new URL(`./out/${shot}.png`, HERE).pathname, fullPage: true });
  }
  return {
    axe: axe.reduce((n, v) => n + v.nodes, 0),
    rules: Object.fromEntries(axe.map((v) => [v.id, v.nodes])),
    where,
    taps,
    overflow: overflow ? 1 : 0,
    bars,
    ring,
    errors: errs.length,
  };
}

/** Run jobs a few at a time; results come back in job order. */
async function pool(jobs, size) {
  const out = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next;
      next += 1;
      out[i] = await jobs[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, jobs.length) }, worker));
  return out;
}

// Screens run in parallel browser contexts (CI: 4 at a time on a 4-core
// runner). Each context has its own fixed clock and storage, so the counts
// don't depend on the order. E2E_WORKERS=1 runs one at a time.
const WORKERS = Math.max(1, Number(process.env.E2E_WORKERS) || Math.min(4, availableParallelism()));

export async function run({ shots = false } = {}) {
  const server = await serve();
  const browser = await chromium.launch();
  const jobs = [];
  // E2E_STATES_ONLY=1 skips the routes, for working on the states.
  for (const dir of process.env.E2E_STATES_ONLY ? [] : DIRS) {
    for (const width of WIDTHS) {
      jobs.push(async () => {
        const rows = {};
        const raw = structuredClone(FIXTURE);
        raw.profile = { ...(raw.profile || {}), locale: dir === 'rtl' ? 'ar' : 'en' };
        // The fixture person has answered the safety check with no limits
        // (SAFE-1), so the screens under test are the app, not the check.
        raw.safety = SCREENED;
        const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce', colorScheme: 'dark', bypassCSP: true });
        await ctx.clock.setFixedTime(NOW);
        await withInsets(ctx);
        await ctx.addInitScript(([k, d]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, d); } catch { /* fresh */ } }, [KEY, JSON.stringify(raw)]);
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        for (const route of ROUTES) {
          await page.goto(`http://localhost:${PORT}/#${route}`, { timeout: 15000 });
          await page.waitForTimeout(700);
          // Arabic strings arrive in phase 13; until then the RTL pass sets
          // the direction itself, so the layout is tested both ways now.
          if (dir === 'rtl') await page.evaluate(() => { document.documentElement.dir = 'rtl'; document.documentElement.lang = 'ar'; });
          const key = `${route} ${width} ${dir}`;
          rows[key] = await measure(page, errors, key, shots && `${route.replace(/\W+/g, '_') || 'home'}-${width}-${dir}`);
        }
        await ctx.close();
        return rows;
      });
    }
  }
  for (const state of STATES) {
    for (const width of STATE_WIDTHS) {
      jobs.push(async () => {
        const raw = structuredClone(FIXTURE);
        const data = state.data ? state.data(raw) : raw;
        const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce', colorScheme: 'dark', bypassCSP: true });
        await ctx.clock.setFixedTime(state.now || NOW);
        await withInsets(ctx);
        await ctx.addInitScript(([k, d]) => { try { if (!localStorage.getItem(k)) localStorage.setItem(k, d); } catch { /* fresh */ } }, [KEY, JSON.stringify(data)]);
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`http://localhost:${PORT}/#${state.route}`, { timeout: 15000 });
        await page.waitForTimeout(700);
        if (state.font) await page.evaluate((f) => { document.documentElement.style.fontSize = f; }, state.font);
        // The badge fanfare and the open-on-start sheets would sit over the
        // control a state taps; they have their own rows above.
        await page.addStyleTag({ content: '.fanfare,.intro,.toast{display:none!important}' });
        page.setDefaultTimeout(8000);
        const key = `state: ${state.name} ${width}`;
        try {
          for (let i = 0; i < 3 && await page.getByRole('dialog').count(); i += 1) {
            const close = page.getByRole('dialog').getByRole('button', { name: /^(Done|Close|Got it|Later)$/ }).last();
            if (!(await close.count())) break;
            await close.click({ force: true });
            await page.waitForTimeout(600);
          }
          if (state.act) await state.act(page);
          if (state.check) await state.check(page);
          await page.waitForTimeout(500);
        } catch (err) {
          // A state that can't be reached counts as an error, not a crash of the run.
          errors.push(`could not open: ${err.message.split('\n')[0]}`);
        }
        const row = await measure(page, errors, key, shots && `state-${state.name.replace(/\W+/g, '_')}-${width}`, state.floor);
        await ctx.close();
        return { [key]: row };
      });
    }
  }
  try {
    return Object.assign({}, ...(await pool(jobs, WORKERS)));
  } finally {
    await browser.close();
    stop(server);
  }
}

const CHECKS = ['axe', 'taps', 'overflow', 'bars', 'ring', 'errors'];

export function compare(now, base) {
  const worse = [];
  for (const [key, row] of Object.entries(now)) {
    const was = base[key] || {};
    for (const c of CHECKS) if (row[c] > (was[c] ?? 0)) worse.push(`${key}: ${c} ${was[c] ?? 0} -> ${row[c]}${c === 'axe' ? ` ${JSON.stringify(row.rules)}` : ''}${row.where?.[c]?.length ? ` at ${row.where[c].slice(0, 4).join('; ')}` : ''}`);
  }
  return worse;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await run({ shots: process.argv.includes('--shots') });
  const totals = Object.fromEntries(CHECKS.map((c) => [c, Object.values(report).reduce((n, r) => n + r[c], 0)]));
  console.log(`Phone harness: ${Object.keys(report).length} screens.`, totals);
  if (process.argv.includes('--update')) {
    writeFileSync(BASELINE, `${JSON.stringify(Object.fromEntries(Object.entries(report).map(([k, r]) => [k, Object.fromEntries(CHECKS.map((c) => [c, r[c]]))])), null, 1)}\n`);
    console.log('Baseline updated.');
  } else {
    let base = {};
    try { base = JSON.parse(readFileSync(BASELINE, 'utf8')); } catch { /* none yet */ }
    const worse = compare(report, base);
    for (const w of worse) console.log(`WORSE ${w}`);
    if (worse.length) process.exit(1);
    console.log('No screen got worse.');
  }
  process.exit(0);
}
