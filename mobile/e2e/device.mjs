// Device tests (P14-17): the states the screen harness doesn't reach.
//   setup      a new phone opens on first-time setup, in both directions,
//              with no sideways scroll and no page errors
//   speed      a 3-year data file: Home shows in under 2 s at 6x slower CPU
//   set-log    the same file: a logged set shows in under 100 ms at 6x
//              slower CPU with no task over 50 ms, and Strong vibration
//              buzzes (FEEL-1)
//   wrap-up    Sunday: the week card opens the sheet, and the picture is a
//              1080 x 1350 PNG (WRAP-1)
//   back       last workout 20 days ago: Welcome back, no streak chip,
//              lighter first session, then normal again (BACK-1)
//   midnight   Home moves to the new day at midnight, with the app open
//   fake-fs    the file mirror, in a build with a fake file system:
//              a newer file copy wins, a broken localStorage copy recovers
//              from the file, and starting writes the file
//   auto-backup  turn on, one checked file, restore preview, turn off (BAK-1)
//   encrypted    cloud folder: passphrase, test restore, new-phone unlock
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
// FEEL-1: tap to the new set row, and the longest main-thread task, at 6x.
const SET_BUDGET_MS = 100;
const TASK_BUDGET_MS = 50;
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

async function setLog(browser) {
  const base = bigFixture('2026-11-06', 3);
  const data = JSON.stringify({ ...base, settings: { ...base.settings, training: { ...base.settings?.training, haptics: 'strong' } } });
  const { ctx, page, errors } = await context(browser, { store: { [KEY]: data } });
  // The browser build buzzes through navigator.vibrate: record the calls.
  await ctx.addInitScript(() => {
    window.__buzz = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p) => { window.__buzz.push(p); return true; } });
  });
  await page.goto(`${URL0}#/workout`);
  await page.addStyleTag({ content: '.fanfare,.intro,.toast{display:none!important}' });
  await page.getByRole('button', { name: /^Start / }).first().click({ timeout: 20000 });
  const weight = page.getByRole('spinbutton', { name: 'Weight (kg)', exact: true });
  // Let the prefill settle first, or it can overwrite the typed weight.
  await page.waitForTimeout(1500);
  await weight.fill('20');
  await page.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  // Measured in the page: the tap, then the frame after the new row lands.
  const r = await page.evaluate(() => new Promise((resolve) => {
    const button = document.querySelector('.ex-card.current .log-btn');
    // The session's "n/N sets" line: after a set in a superset, the card
    // moves on to the partner, so its own rows aren't a reliable signal.
    const rows = () => {
      const line = [...document.querySelectorAll('.muted.small')].find((e) => /\d+\/\d+ sets/.test(e.textContent));
      return line ? Number(line.textContent.match(/(\d+)\/\d+ sets/)[1]) : -1;
    };
    const before = rows();
    const tasks = [];
    const obs = new PerformanceObserver((list) => { tasks.push(...list.getEntries()); });
    obs.observe({ type: 'longtask' });
    window.__buzz.length = 0;
    const t0 = performance.now();
    // Long tasks from the tap to the frame after the row: the batched disk
    // write comes 400 ms later on purpose (store/useData.js) and is not
    // part of the tap.
    const done = () => requestAnimationFrame(() => {
      const ms = performance.now() - t0;
      // Long tasks are reported late: wait a little, then keep only those
      // that started before the row showed.
      setTimeout(() => {
        tasks.push(...obs.takeRecords());
        obs.disconnect();
        const inTap = tasks.filter((e) => e.startTime <= t0 + ms).reduce((m, e) => Math.max(m, e.duration), 0);
        resolve({ ms: Math.round(ms), longest: Math.round(inTap), buzz: window.__buzz.slice() });
      }, 150);
    });
    const mo = new MutationObserver(() => { if (rows() > before) { mo.disconnect(); done(); } });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    // Never hang the run: a set that doesn't show in 5 s is a failure.
    setTimeout(() => { mo.disconnect(); obs.disconnect(); resolve({ ms: 99999, longest: Math.round(tasks.reduce((m, e) => Math.max(m, e.duration), 0)), buzz: window.__buzz.slice(), stuck: `${before} rows, button ${button.disabled ? 'disabled' : 'enabled'}` }); }, 5000);
    button.click();
  }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  console.log(`     set log at 6x: ${r.ms} ms to the row, longest task ${r.longest} ms${r.stuck ? ` (${r.stuck})` : ''}`);
  check('set-log: a logged set shows in under 100 ms at 6x slower CPU', r.ms < SET_BUDGET_MS && !errors.length, `${r.ms} ms, budget ${SET_BUDGET_MS}${errors.length ? `; ${errors.join('; ')}` : ''}`);
  check('set-log: no main-thread task over 50 ms while logging', r.longest < TASK_BUDGET_MS, `${r.longest} ms`);
  check('set-log: Strong vibration buzzes 30 ms for a set', r.buzz.some((p) => JSON.stringify(p) === '[30]'), JSON.stringify(r.buzz));
  await ctx.close();
}

async function wrapUp(browser) {
  const sunday = new Date('2026-11-08T07:00:00Z');
  const { ctx, page, errors } = await context(browser, { time: sunday, store: { [KEY]: fixture() } });
  await page.goto(`${URL0}#/`);
  await page.addStyleTag({ content: '.fanfare,.intro,.toast{display:none!important}' });
  // What's new opens first on a new version: close it.
  const news = page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true });
  if (await news.isVisible({ timeout: 3000 }).catch(() => false)) { await news.click(); await page.waitForTimeout(600); }
  const open = page.getByRole('button', { name: /See your week/ });
  const shown = await open.isVisible({ timeout: 8000 }).catch(() => false);
  check('wrap-up: on Sunday Home offers last week', shown, shown ? '' : 'no card');
  if (shown) {
    await open.click();
    const sheet = page.getByRole('dialog');
    const rows = await sheet.locator('.list-row').count();
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), sheet.getByRole('button', { name: /Share as a picture/ }).click()]);
    let size = '';
    if (download) {
      const buf = await (await import('node:fs')).promises.readFile(await download.path());
      // PNG header: width and height at bytes 16-23.
      size = `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
    }
    check('wrap-up: the sheet shows the week and shares a 1080 x 1350 picture', rows >= 3 && size === '1080x1350' && /^fitness-os-week-2026-11-01\.png$/.test(download?.suggestedFilename() || '') && !errors.length, `${rows} rows, ${size || 'no picture'} ${download?.suggestedFilename() || ''} ${errors.join('; ')}`.trim());
  }
  await ctx.close();
}

async function comebackDay(browser) {
  const base = bigFixture('2026-11-06', 0.3);
  // Today's first exercise, so the last session (20 days ago) has its loads.
  const peek = await context(browser, { store: { [KEY]: JSON.stringify(base) } });
  await peek.page.goto(`${URL0}#/workout`);
  // The name without a superset letter (".pair").
  const first = (await peek.page.locator('.list .list-row .grow > div').first().evaluate((el) => [...el.childNodes].filter((n) => !n.classList?.contains('pair')).map((n) => n.textContent).join(''), null, { timeout: 20000 })).trim();
  await peek.ctx.close();
  const known = base.exercises.find((e) => e.name === first);
  const exId = known ? known.id : 9001;
  const last = { id: 9001, log_date: '2026-10-17', workout_type: 'gym', started_at: '2026-10-17T07:00:00', finished_at: '2026-10-17T08:00:00', sets: [1, 2, 3].map((n) => ({ id: 90010 + n, exercise_id: exId, set_number: n, reps: 12, weight_kg: 60, rpe: null, rir: null, is_warmup: false })) };
  const workouts = [...base.workouts.filter((w) => w.log_date < '2026-10-17'), last];
  const exercises = known ? base.exercises : [...base.exercises, { id: exId, name: first, muscle_group: 'Chest', is_custom: false }];
  const { ctx, page, errors } = await context(browser, { store: { [KEY]: JSON.stringify({ ...base, exercises, workouts }) } });
  await page.goto(`${URL0}#/`);
  await page.addStyleTag({ content: '.fanfare,.intro,.toast{display:none!important}' });
  const news = page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true });
  if (await news.isVisible({ timeout: 3000 }).catch(() => false)) { await news.click(); await page.waitForTimeout(600); }
  const welcome = await page.getByText('Welcome back', { exact: true }).isVisible({ timeout: 8000 }).catch(() => false);
  const chip = await page.getByText(/-week streak/).count();
  check('back: 20 days away opens to Welcome back, with no streak chip', welcome && chip === 0, `${welcome ? '' : 'no card '}${chip ? 'streak chip shown' : ''}`.trim());

  await page.goto(`${URL0}#/workout`);
  await page.getByRole('button', { name: /^Start / }).first().click({ timeout: 20000 });
  await page.waitForTimeout(1500);
  const reason = (await page.locator('.ex-card.current .reason').first().textContent().catch(() => '')) || '';
  const kg = Number(await page.getByRole('spinbutton', { name: 'Weight (kg)', exact: true }).inputValue());
  // 90% of 60 kg (all sets at the top of the range would otherwise add).
  check('back: the first session back is 90% of last time, never "add"', /^Welcome back: [\d.]+ kg today, a little lighter/.test(reason) && kg > 50 && kg < 60, `${kg} kg, "${reason}"`);
  await page.getByRole('button', { name: /^Log set 1/ }).click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await page.getByRole('button', { name: /^(Save workout|Save as a short session)$/ }).click();
  await page.waitForTimeout(800);
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).workouts.at(-1), KEY);
  await page.goto(`${URL0}#/`);
  await page.waitForTimeout(1000);
  const after = await page.getByText('Welcome back', { exact: true }).count();
  check('back: that session is saved as easy, and Home is back to normal', saved?.easy === true && Boolean(saved.finished_at) && after === 0 && !errors.length, `easy ${saved?.easy}, card ${after}${errors.length ? `; ${errors.join('; ')}` : ''}`);
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

// BAK-1 part 2: a cloud folder gets an encrypted file, set up with a
// recovery passphrase that is tested straight away; on a "new phone" (no
// key) the backup opens with that passphrase only.
async function encryptedBackup(browser) {
  const FOLDER = 'fitness-os-fake-backup-folder';
  const PASS = 'blue kettle seven hills';
  const { ctx, page, errors } = await context(browser, { store: { [KEY]: fixture(), [FOLDER]: '{}', 'fitness-os-fake-backup-synced': '1' } });
  await page.goto(`${URL0}#/settings/data`);
  const box = page.getByTestId('auto-backup');
  await box.waitFor({ timeout: 10000 });
  await box.getByRole('button', { name: /Turn on automatic backup/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByText(/Recovery passphrase/).first().waitFor({ timeout: 10000 });
  const none = await page.evaluate((k) => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')), FOLDER);
  check('encrypted: a cloud folder asks for a passphrase before writing anything', none.length === 0, none.join(', '));
  await sheet.getByLabel(/Passphrase \(at least/).fill('short');
  await sheet.getByLabel(/Type it again/).fill('short');
  await sheet.getByRole('button', { name: /Save and test/ }).click();
  const short = await sheet.getByText(/Use at least 10 characters/).isVisible().catch(() => false);
  check('encrypted: a short passphrase is refused', short);
  await sheet.getByLabel(/Passphrase \(at least/).fill(PASS);
  await sheet.getByLabel(/Type it again/).fill(PASS);
  await sheet.getByRole('button', { name: /Save and test/ }).click();
  await box.getByText(/Last backup checked: today/).waitFor({ timeout: 30000 });
  const file = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), FOLDER);
  const names = Object.keys(file);
  const text = file['fitness-os-backup-2026-11-06.json.enc'] || '';
  check('encrypted: one .json.enc, nothing readable, no plain copy', names.length === 1 && text.includes('"format":"fitness-os-backup-enc"') && !text.includes('log_date') && !errors.length, names.join(', '));
  const done = await page.getByText(/opened again with your passphrase/).waitFor({ timeout: 30000 }).then(() => true, () => false);
  check('encrypted: the test restore with the passphrase passed', done);
  await box.getByRole('button', { name: /Restore from this folder/ }).click();
  const preview = await page.getByText(/Replace what's on this phone/).isVisible().catch(() => false);
  check('encrypted: on this phone restore opens without asking', preview);
  await page.getByRole('button', { name: /^Cancel$/ }).first().click();
  // A new phone: the Keystore key is gone.
  await page.evaluate(() => localStorage.removeItem('fitness-os-fake-backup-key'));
  await box.getByRole('button', { name: /Restore from this folder/ }).click();
  const unlock = page.getByRole('dialog');
  await unlock.getByText(/Open encrypted backup/).waitFor({ timeout: 10000 });
  await unlock.getByLabel(/Recovery passphrase/).fill('blue kettle seven hill');
  await unlock.getByRole('button', { name: /^Open$/ }).click();
  await unlock.getByText(/does not open this backup/).waitFor({ timeout: 30000 });
  check('encrypted: a wrong passphrase is refused in plain words', true);
  await unlock.getByLabel(/Recovery passphrase/).fill(PASS);
  await unlock.getByRole('button', { name: /^Open$/ }).click();
  await page.getByText(/Replace what's on this phone/).waitFor({ timeout: 30000 });
  check('encrypted: on a new phone the passphrase opens it to the usual preview', !errors.length, errors.join(' | '));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('encrypted: the Data page fits 360 px', !wide);
  await ctx.close();
}

const server = await serve();
const browser = await chromium.launch();
try {
  await setupStates(browser);
  await speed(browser);
  await setLog(browser);
  await wrapUp(browser);
  await comebackDay(browser);
  await midnight(browser);
  await fakeFs(browser);
  await autoBackup(browser);
  await encryptedBackup(browser);
} finally {
  await browser.close();
  stop(server);
}
const failed = results.filter((r) => !r.ok);
console.log(`Device tests: ${results.length - failed.length}/${results.length} passed.`);
process.exit(failed.length ? 1 : 0);
