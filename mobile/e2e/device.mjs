// Device tests (P14-17): the states the screen harness doesn't reach.
//   setup      a new phone opens on first-time setup, in both directions,
//              with no sideways scroll and no page errors
//   speed      a 3-year data file: Home shows in under 2 s at 6x slower CPU
//   midnight   Home moves to the new day at midnight, with the app open
//   fake-fs    the file mirror, in a build with a fake file system:
//              a newer file copy wins, a broken localStorage copy recovers
//              from the file, and starting writes the file
//   auto-backup  turn on, one checked file, restore preview, turn off (BAK-1)
//
//   npm run e2e:device     builds with VITE_FAKE_FS=1 into dist-device/,
//                          then runs every check; exits 1 on a failure
import { spawn } from 'node:child_process';

import { chromium } from 'playwright';

import { bigFixture } from './bigFixture.mjs';

const PORT = 4181;
const URL0 = `http://localhost:${PORT}/`;
const KEY = 'fitness-os-data-v1';
const FS_KEY = 'fitness-os-fake-fs';
const TZ = 'Africa/Cairo';
const HOME_BUDGET_MS = 2000;
// Friday 6 Nov 2026, 09:00 in Cairo, like the screen harness.
const NOW = new Date('2026-11-06T07:00:00Z');

function stop(child) {
  try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); }
}

// Home is up once its Today tiles are drawn (it has no week strip since UX-04).
const HOME_READY = '.home .tile-grid';

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
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}

async function context(browser, { width = 360, store = {}, time = NOW, fake = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce', colorScheme: 'dark', timezoneId: TZ });
  if (fake) await ctx.clock.install({ time });
  else await ctx.clock.setFixedTime(time);
  await ctx.addInitScript((s) => {
    // Only on the first load of this context, so a reload sees what the app wrote.
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, store);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, errors };
}

const fixture = (over = {}) => JSON.stringify({ ...bigFixture('2026-11-06', 0.1), ...over });

async function setupStates(browser) {
  for (const dir of ['ltr', 'rtl']) {
    for (const width of [360, 412]) {
      const { ctx, page, errors } = await context(browser, { width });
      await page.goto(`${URL0}#/`);
      if (dir === 'rtl') await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
      const shown = await page.getByText('Welcome to Fitness OS').first().isVisible({ timeout: 5000 }).catch(() => false);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      check(`setup: a new phone opens on setup (${width} ${dir})`, shown && !overflow && !errors.length, `${shown ? '' : 'setup not shown '}${overflow ? 'sideways scroll ' : ''}${errors.join('; ')}`.trim());
      await ctx.close();
    }
  }
}

async function speed(browser) {
  const data = JSON.stringify(bigFixture('2026-11-06', 3));
  const { ctx, page, errors } = await context(browser, { store: { [KEY]: data } });
  // The first open upgrades the old file once (and keeps a snapshot); the
  // check is the everyday open after that.
  await page.goto(`${URL0}#/`);
  await page.locator(HOME_READY).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const t0 = Date.now();
  await page.reload();
  await page.locator(HOME_READY).first().waitFor({ timeout: 20000 });
  const ms = Date.now() - t0;
  check('speed: Home with 3 years of data, 6x slower CPU', ms < HOME_BUDGET_MS && !errors.length, `${ms} ms, budget ${HOME_BUDGET_MS}${errors.length ? `; ${errors.join('; ')}` : ''}`);
  await ctx.close();
}

async function midnight(browser) {
  // 23:59:30 on Friday in Cairo, with the app open on Home.
  const { ctx, page, errors } = await context(browser, { store: { [KEY]: fixture() }, time: new Date('2026-11-06T21:59:30Z'), fake: true });
  await page.goto(`${URL0}#/`);
  // Home has no week strip since UX-04: the date under the greeting is the day it shows.
  const today = page.locator('.home-date').first();
  await today.waitFor({ timeout: 10000 });
  const before = await today.textContent();
  await ctx.clock.runFor(60000);
  await page.waitForFunction((b) => document.querySelector('.home-date')?.textContent !== b, before, { timeout: 5000 }).catch(() => {});
  const after = await today.textContent();
  check('midnight: Home moves to Saturday with the app open', /^Fri/.test(before || '') && /^Sat/.test(after || '') && !errors.length, `${before} -> ${after}`);
  await ctx.close();
}

async function fakeFs(browser) {
  const older = { saved_at: 1000, settings: { notifications: false, modules: {} } };
  // 1. The file copy is newer than localStorage: the file wins.
  {
    const file = JSON.parse(fixture({ saved_at: 2000 }));
    file.exercise_notes = { 'Leg Press': 'from the file' };
    const local = JSON.parse(fixture(older));
    const { ctx, page, errors } = await context(browser, { store: { [KEY]: JSON.stringify(local), [FS_KEY]: JSON.stringify({ 'fitness-os-data.json': JSON.stringify(file) }) } });
    await page.goto(`${URL0}#/`);
    await page.locator(HOME_READY).first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    const note = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}').exercise_notes?.['Leg Press'], KEY);
    check('fake-fs: a newer file copy wins over localStorage', note === 'from the file' && !errors.length, String(note));
    await ctx.close();
  }
  // 2. localStorage can't be read: the file brings the data back.
  {
    const file = JSON.parse(fixture({ saved_at: 2000 }));
    const { ctx, page, errors } = await context(browser, { store: { [KEY]: '{"broken', [FS_KEY]: JSON.stringify({ 'fitness-os-data.json': JSON.stringify(file) }) } });
    await page.goto(`${URL0}#/`);
    const home = await page.locator(HOME_READY).first().isVisible({ timeout: 10000 }).catch(() => false);
    const workouts = await page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)).workouts.length; } catch { return -1; } }, KEY);
    check('fake-fs: a broken localStorage copy recovers from the file', home && workouts === file.workouts.length && !errors.length, `home ${home}, workouts ${workouts}/${file.workouts.length}`);
    await ctx.close();
  }
  // 3. Starting writes the mirror, and the file reads back.
  {
    const { ctx, page, errors } = await context(browser, { store: { [KEY]: fixture() } });
    await page.goto(`${URL0}#/`);
    await page.locator(HOME_READY).first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(1500);
    const ok = await page.evaluate((k) => { try { const m = JSON.parse(localStorage.getItem(k)); return Boolean(JSON.parse(m['fitness-os-data.json']).workouts); } catch { return false; } }, FS_KEY);
    check('fake-fs: the data file is written on start', ok && !errors.length, errors.join('; '));
    await ctx.close();
  }
}

// BAK-1: automatic backup, with the pretend folder the fake-fs build has.
async function autoBackup(browser) {
  const FOLDER = 'fitness-os-fake-backup-folder';
  const files = (page) => page.evaluate((k) => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).sort(), FOLDER);
  const { ctx, page, errors } = await context(browser, { store: { [KEY]: fixture(), [FOLDER]: JSON.stringify({ 'holiday.jpg': 'JPEG' }) } });
  await page.goto(`${URL0}#/settings/data`);
  const box = page.getByTestId('auto-backup');
  await box.waitFor({ timeout: 10000 });
  await box.getByRole('button', { name: /Turn on automatic backup/ }).click();
  await box.getByText(/Last backup checked: today/).waitFor({ timeout: 10000 });
  const first = await files(page);
  check('auto-backup: turning it on writes one checked file and leaves other files alone', first.length === 2 && first[0] === 'fitness-os-backup-2026-11-06.json' && first[1] === 'holiday.jpg' && !errors.length, first.join(', '));
  const saved = await page.evaluate(([k, f]) => {
    const text = JSON.parse(localStorage.getItem(f))['fitness-os-backup-2026-11-06.json'];
    const state = JSON.parse(localStorage.getItem(k)).settings.auto_backup;
    return { workouts: JSON.parse(text).workouts.length, compact: !text.includes('\n'), state, leak: /content:|uri/i.test(JSON.stringify(state)) };
  }, [KEY, FOLDER]).catch(() => null);
  // The store saves a moment after the change.
  await page.waitForTimeout(1500);
  const state = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).settings.auto_backup, KEY);
  check('auto-backup: the state is saved, with no folder address in the data', state?.on === true && state.last_error == null && state.last_name === 'fitness-os-backup-2026-11-06.json' && saved && saved.compact && saved.workouts === JSON.parse(fixture()).workouts.length && !/content:/.test(JSON.stringify(state)), JSON.stringify(state));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('auto-backup: the Data page fits 360 px with it on', !wide);
  await box.getByRole('button', { name: /Restore from this folder/ }).click();
  const preview = await page.getByText(/Replace what's on this phone/).isVisible().catch(() => false);
  check('auto-backup: restore opens the usual preview first', preview && !errors.length);
  await box.getByRole('button', { name: /^Turn off/ }).click();
  await page.getByRole('button', { name: /Turn off and delete the backups/ }).click();
  await box.getByRole('button', { name: /Turn on automatic backup/ }).waitFor({ timeout: 10000 });
  const after = await files(page);
  check('auto-backup: turning it off with delete removes only the app\'s files', after.length === 1 && after[0] === 'holiday.jpg' && !errors.length, after.join(', '));
  await ctx.close();
}

const server = await serve();
const browser = await chromium.launch();
try {
  await setupStates(browser);
  await speed(browser);
  await midnight(browser);
  await fakeFs(browser);
  await autoBackup(browser);
} finally {
  await browser.close();
  stop(server);
}
const failed = results.filter((r) => !r.ok);
console.log(`Device tests: ${results.length - failed.length}/${results.length} passed.`);
process.exit(failed.length ? 1 : 0);
