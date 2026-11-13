// Journeys (TEST-1): the app is tapped through like a person would, at
// 360 px, in Cairo time, with no network. Each journey starts from an empty
// app unless it says otherwise, uses only made-up data, and ends by
// checking the crash screen is not showing.
//
//   setup      every setup step answered, then Home
//   workout    log 3 sets with the steppers, leave and return, finish,
//              summary, History
//   resume     a reload in the middle of a workout keeps it
//   weigh-in   save a weight from Home
//   ate-else   "I ate something else" on Meals, and the food is remembered
//   restore    export, wipe, restore: the data is the same
//   gate       data with no safety check shows the check first
//
//   npm run e2e:journeys   builds with VITE_FAKE_FS=1 into dist-device/,
//                          then runs every journey; exits 1 on a failure
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

import { chromium } from 'playwright';

import en from '../src/i18n/en.js';

const PORT = 4183;
const URL0 = `http://localhost:${PORT}/`;
const KEY = 'fitness-os-data-v1';
const TZ = 'Africa/Cairo';
// Sunday 8 Nov 2026, 09:00 in Cairo: a training day on every plan.
const NOW = new Date('2026-11-08T07:00:00Z');
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const OUT = new URL('./out/', import.meta.url);

function stop(child) {
  try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); }
}

async function serve() {
  const child = spawn('npx', ['vite', 'preview', '--outDir', 'dist-device', '--port', String(PORT), '--strictPort'], { cwd: new URL('..', import.meta.url), stdio: 'ignore', detached: true });
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(URL0)).ok) return child; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  stop(child);
  throw new Error('vite preview did not start');
}

const results = [];

/** A phone: 360 px, Cairo, a fixed day, no network. */
async function phone(browser, { store = {}, time = NOW } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, reducedMotion: 'reduce', colorScheme: 'dark', timezoneId: TZ, locale: 'en-GB', acceptDownloads: true });
  await ctx.clock.install({ time });
  await ctx.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, store);
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('request', (r) => { if (!r.url().startsWith(URL0) && !/^(data|blob):/.test(r.url())) problems.push(`network: ${r.url()}`); });
  // Offline for everything but the app's own files (on a phone those are
  // inside the APK): any other request is refused and fails the journey.
  await ctx.route((url) => !url.href.startsWith(URL0), (route) => route.abort());
  await page.goto(URL0);
  await page.locator('#root > *').first().waitFor({ timeout: 15000 });
  return { ctx, page, problems };
}

const read = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const btn = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' });

/** The store saves a moment after a change; let the clock run past it. */
async function settle(page, ms = 1500) {
  await page.clock.runFor(ms);
  await page.waitForTimeout(150);
}

async function noCrash(page) {
  if (await page.getByText(en['crash.title'], { exact: true }).count()) throw new Error('the crash screen is showing');
}

async function journey(name, browser, fn, opts) {
  if (ONLY.length && !ONLY.includes(name)) return;
  const p = await phone(browser, opts);
  let error = null;
  try {
    await fn(p.page, p);
    await noCrash(p.page);
    if (p.problems.length) throw new Error(p.problems.join('; '));
  } catch (err) {
    error = err;
    mkdirSync(OUT, { recursive: true });
    await p.page.screenshot({ path: new URL(`journey-${name}.png`, OUT).pathname }).catch(() => {});
    if (process.env.E2E_VERBOSE) console.log((await p.page.locator('body').innerText().catch(() => '')).slice(0, 1500));
  }
  await p.ctx.close();
  results.push({ name, ok: !error });
  console.log(`${error ? 'FAIL' : 'ok  '} ${name}${error ? `\n     ${String(error.message).split('\n').slice(0, 6).join('\n     ')}` : ''}`);
}

/** Go through first-time setup, answering everything. */
async function setUp(page) {
  await btn(page, en['setup.start']).click();
  await page.getByLabel(en['setup.name']).fill('Sam');
  await btn(page, en['setup.male']).click();
  await page.getByLabel(en['setup.birthYear']).fill('1996');
  await page.getByLabel(en['setup.height']).fill('178');
  await page.getByLabel(en['setup.weight']).fill('82');
  await btn(page, en['setup.next']).click();
  for (const no of await btn(page, en['safety.no']).all()) await no.click();
  await btn(page, en['setup.next']).click();
  await page.getByRole('button', { name: new RegExp(`^${en['setup.goal.lose']}`) }).first().click();
  await btn(page, en['setup.next']).click();
  await page.getByRole('button', { name: new RegExp(`^${en['setup.expNew']}`) }).click();
  await btn(page, en['setup.next']).click();
  await btn(page, en['setup.go']).click();
  await page.locator('.home').first().waitFor({ timeout: 10000 });
}

async function setup(page) {
  await setUp(page);
  await settle(page);
  const d = await read(page);
  if (!d.setup?.done_on || d.setup.skipped) throw new Error('setup was not saved as done');
  if (d.profile?.height_cm !== 178) throw new Error('the body answers were not saved');
  if (d.safety?.screen_version == null) throw new Error('the safety check was not saved');
  if (!(await page.locator('.home .session-card, .home .workout-card, .home [class*=session]').count())) throw new Error('Home has no session card');
  if (await page.getByRole('heading', { name: en['whatsNew.title'] }).count()) throw new Error("a new person is shown What's new");
}

const tab = (page, name) => page.getByRole('link', { name, exact: true });
const num = (page, label) => page.getByRole('spinbutton', { name: label, exact: true });

/** Start today's session and log `n` sets with whatever is prefilled. */
async function startAndLog(page, n) {
  await tab(page, 'Start').click();
  await page.getByRole('button', { name: /^Start / }).first().click();
  for (let i = 1; i <= n; i += 1) {
    await num(page, 'Weight (kg)').fill('20');
    await btn(page, en['workout.logSet'].replace('{n}', i)).click();
    await settle(page, 300);
  }
}

async function workout(page) {
  await setUp(page);
  await tab(page, 'Start').click();
  await page.getByRole('button', { name: /^Start / }).first().click();
  // Set 1: the + stepper twice, then held for a second.
  const weight = num(page, 'Weight (kg)');
  const more = btn(page, 'More Weight (kg)');
  const start = Number(await weight.inputValue());
  await more.click();
  await more.click();
  const tapped = Number(await weight.inputValue());
  if (!(tapped > start)) throw new Error(`two taps on + did not raise the weight (${start} -> ${tapped})`);
  const box = await more.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(1000);
  await page.mouse.up();
  const held = Number(await weight.inputValue());
  if (!(held - tapped > 3)) throw new Error(`holding + for a second moved the weight by ${held - tapped}, expected more than 3`);
  await btn(page, en['workout.logSet'].replace('{n}', 1)).click();
  await settle(page, 300);
  for (const i of [2, 3]) {
    await btn(page, en['workout.logSet'].replace('{n}', i)).click();
    await settle(page, 300);
  }
  // Leave for another tab and come back: still running, 3 sets.
  await tab(page, 'Meals').click();
  await page.getByRole('heading', { name: 'Meals', exact: true }).waitFor();
  await tab(page, 'Start').click();
  await btn(page, en['workout.finishWorkout']).waitFor();
  await settle(page);
  let d = await read(page);
  const open = d.workouts.find((w) => !w.finished_at);
  if (!open || open.sets.length !== 3) throw new Error(`expected a running workout with 3 sets, found ${open ? open.sets.length : 'none'}`);
  if (open.sets[0].weight_kg !== held) throw new Error(`set 1 saved ${open.sets[0].weight_kg} kg, the stepper showed ${held}`);
  // Finish, summary, History.
  await btn(page, en['workout.finishWorkout']).click();
  await page.getByRole('button', { name: new RegExp(`^(${en['workout.save']}|${en['workout.saveShort']})$`) }).click();
  await page.getByRole('heading', { name: en['finish.title'] }).waitFor();
  await btn(page, en['finish.done']).click();
  await settle(page);
  d = await read(page);
  const saved = d.workouts.find((w) => w.id === open.id);
  if (!saved?.finished_at || saved.sets.length !== 3 || !(saved.duration_min >= 1)) throw new Error('the finished workout was not saved with 3 sets and its minutes');
  await page.goto(`${URL0}#/history`);
  await page.getByText(/3 sets/).first().waitFor();
}

async function resume(page) {
  await setUp(page);
  await startAndLog(page, 1);
  await settle(page);
  await page.reload();
  await page.locator('#root > *').first().waitFor();
  // The workout is still open where it was left, Home offers to carry
  // on, and the set is still there.
  await btn(page, en['workout.logSet'].replace('{n}', 2)).waitFor();
  await tab(page, 'Home').click();
  await btn(page, en['home.resume']).click();
  await btn(page, en['workout.logSet'].replace('{n}', 2)).waitFor();
  const d = await read(page);
  const open = d.workouts.find((w) => !w.finished_at);
  if (!open || open.sets.length !== 1) throw new Error('the set logged before the reload is gone');
}

async function weighIn(page) {
  await setUp(page);
  await page.getByRole('button', { name: new RegExp(`${en['home.weightLog']}|${en['home.weightFirst']}`) }).first().click();
  await num(page, en['weighIn.kg']).fill('80.5');
  await btn(page, en['weighIn.save']).click();
  await page.locator('.home').getByText(/80\.5/).first().waitFor();
  await settle(page);
  const d = await read(page);
  if (d.body_logs.at(-1)?.weight_kg !== 80.5 || d.body_logs.at(-1)?.log_date !== '2026-11-08') throw new Error('the weigh-in was not saved for today');
}

async function ateElse(page) {
  await setUp(page);
  await tab(page, 'Meals').click();
  // The friends build opens Meals on the simple view; the meal plan is
  // one tap away.
  const toPlan = btn(page, en['mealsSimple.toPlan']);
  await page.getByRole('heading', { name: 'Meals', exact: true }).waitFor();
  if (await toPlan.count()) await toPlan.click();
  await btn(page, en['other.open']).nth(2).click();
  await page.getByPlaceholder(en['other.namePlaceholder']).fill('Koshari');
  await num(page, en['other.kcal']).fill('600');
  await num(page, en['other.protein']).fill('40');
  await btn(page, en['other.save']).click();
  await page.getByText('Koshari').first().waitFor();
  await settle(page);
  const d = await read(page);
  const lunch = d.meal_logs.find((m) => m.log_date === '2026-11-08' && m.meal_slot === 'lunch');
  if (!lunch?.completed) throw new Error('lunch is not marked as eaten');
  if (!JSON.stringify(lunch).includes('Koshari') || !JSON.stringify(lunch).includes('600')) throw new Error('the meal did not keep the name and calories');
  // Open it again: the food is offered under "Your foods".
  await btn(page, en['other.change']).or(btn(page, en['other.open']).nth(2)).first().click();
  await page.getByText(en['other.mine'], { exact: true }).waitFor();
  await page.getByRole('button', { name: /Koshari/ }).first().waitFor();
}

/** The data without the fields a restore is allowed to change. */
function comparable(d) {
  const { saved_at: _s, ...rest } = d;
  const { last_backup_at: _b, ...settings } = rest.settings || {};
  return sorted({ ...rest, settings });
}

/** Keys in one order at every level, so the comparison is deep-equal and
 * not "written in the same order". */
function sorted(v) {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])]));
  return v;
}

async function restore(page, { ctx }) {
  await setUp(page);
  await startAndLog(page, 2);
  await btn(page, en['workout.finishWorkout']).click();
  await page.getByRole('button', { name: new RegExp(`^(${en['workout.save']}|${en['workout.saveShort']})$`) }).click();
  await btn(page, en['finish.done']).click();
  await page.goto(`${URL0}#/settings/data`);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Export a backup/ }).click()]);
  const file = await download.path();
  await settle(page);
  const before = await read(page);
  if (before.workouts.length !== 1) throw new Error('expected one workout before the wipe');
  // Wipe: a new phone has nothing saved.
  await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('seeded', '1'); });
  await page.reload();
  await btn(page, en['setup.restore']).click();
  await page.locator('input[type=file][accept*=json]').setInputFiles(file);
  // A new phone plays safe until the check is answered, so the import
  // asks which safety answers to keep: the backup's are the person's own.
  await btn(page, en['import.useFileSafety']).click();
  await page.getByText(/^Imported 1 workout/).waitFor();
  await settle(page);
  const after = await read(page);
  const a = JSON.stringify(comparable(after));
  const b = JSON.stringify(comparable(before));
  if (a !== b) {
    const keys = [...new Set([...Object.keys(after), ...Object.keys(before)])].filter((k) => JSON.stringify(comparable(after)[k]) !== JSON.stringify(comparable(before)[k]));
    throw new Error(`the restored data differs in: ${keys.join(', ')}\n${keys.map((k) => `${k}: ${JSON.stringify(comparable(before)[k])?.slice(0, 300)}\n  -> ${JSON.stringify(comparable(after)[k])?.slice(0, 300)}`).join('\n')}`);
  }
  void ctx;
}

async function gate(page) {
  // The fixture person never saw the safety check.
  await page.getByRole('heading', { name: en['safety.title'] }).waitFor();
  for (const no of await btn(page, en['safety.no']).all()) await no.click();
  await btn(page, en['safety.save']).click();
  await page.locator('.home').first().waitFor();
  await settle(page);
  const d = await read(page);
  if (d.safety?.screen_version == null) throw new Error('the answers were not saved');
}

function unscreened() {
  const d = JSON.parse(readFileSync(new URL('../src/lib/fixtures/v2-friend.json', import.meta.url), 'utf8'));
  return JSON.stringify({ ...d, safety: { ...d.safety, screen_version: null, screened_on: null, skipped: false } });
}

const JOURNEYS = { setup, workout, resume, 'weigh-in': weighIn, 'ate-else': ateElse, restore, gate };
const STORES = { gate: () => ({ [KEY]: unscreened() }) };

const server = await serve();
const browser = await chromium.launch();
try {
  for (const [name, fn] of Object.entries(JOURNEYS)) await journey(name, browser, fn, { store: STORES[name]?.() });
} finally {
  await browser.close();
  stop(server);
}
const failed = results.filter((r) => !r.ok);
console.log(`Journeys: ${results.length - failed.length}/${results.length} passed.`);
process.exit(failed.length ? 1 : 0);
