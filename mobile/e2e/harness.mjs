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

import { chromium } from 'playwright';

import en from '../src/i18n/en.js';
import { SCREENED } from './bigFixture.mjs';
import { harnessPerson } from './harnessPerson.mjs';
import { addExercise, createSession } from '../src/lib/myRoutine.js';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const HERE = new URL('.', import.meta.url);
// P14-02: each APK has its own counts. FITNESS_OS_FLAVOR=friends checks the
// build the friends install, against e2e/baseline-friends.json.
const FLAVOR = process.env.FITNESS_OS_FLAVOR === 'friends' ? 'friends' : 'yusuf';
const BASELINE = new URL(FLAVOR === 'friends' ? './baseline-friends.json' : './baseline.json', HERE);
// TEST-1 part B: today's data shape (saved foods, water goal, safety, a
// week of meals), built from the v1 fixture through the real upgrade.
const FIXTURE = harnessPerson();
const KEY = 'fitness-os-data-v1';
// Every run sees the same day, so a screen's numbers don't move with the
// calendar (a Saturday meal day vs a Friday rest day). Friday 6 Nov 2026,
// 09:00 in Cairo: the day the baselines were recorded.
const NOW = new Date('2026-11-06T07:00:00Z');
const PORT = 4179;

export const ROUTES = ['/', '/plan', '/plan/routines', '/plan/mine', '/workout', '/meals', '/stats', '/history', '/library', '/settings', '/settings/data', '/settings/about', '/settings/install', '/shopping', '/quests', '/profile', '/snapshots', '/photos', '/intervals', '/session/home', '/session/recovery'];
export const WIDTHS = [360, 390, 412];
export const DIRS = ['ltr', 'rtl'];
export const MIN_TAP = 44;
export const STATE_WIDTHS = [360, 412];

const btnNamed = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' });
const restWeek = (d) => ({ ...d, program: { ...d.program, blocks: d.program.blocks.map((b) => ({ ...b, schedule: b.schedule.map((x) => ({ ...x, session: 'rest', cardio_after: null })) })) } });
const gated = (d) => ({ ...d, safety: { ...SCREENED, gates: { ...SCREENED.gates, no_deficit: true, protein_cap: true, beginner_only: true, needs_clearance: true } } });
const toFullMeals = async (page) => {
  const full = btnNamed(page, en['mealsSimple.toPlan']);
  if (await full.count()) await full.click();
};

/** TEST-1 part B: sheets and states a route alone never shows. Each runs
 * at 360 and 412 px, left to right, with the same checks as the routes.
 * Not here: the permissions sheet (only on a phone) and DaySheet (no
 * screen opens it today). */
export const STATES = [
  { name: 'sheet: weigh-in', route: '/', act: (p) => btnNamed(p, new RegExp(`${en['home.weightLog']}|${en['home.weightFirst']}`)).first().click() },
  { name: 'sheet: ate something else', route: '/meals', act: async (p) => { await toFullMeals(p); await btnNamed(p, en['other.open']).first().click(); } },
  { name: "sheet: what's new", route: '/settings/about', act: (p) => p.getByRole('button', { name: new RegExp(`^${en['whatsNew.title']}`) }).first().click() },
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
      // A rest day (the friends plan on this Friday) asks for a session first.
      if (!(await p.getByRole('button', { name: /^Start / }).count())) await p.locator('.list').last().locator('a, button').first().click();
      await p.waitForTimeout(500);
      const start = p.getByRole('button', { name: /^Start / }).first();
      if (await start.count()) await start.click();
      await p.getByRole('spinbutton', { name: 'Weight (kg)', exact: true }).fill('20');
      await btnNamed(p, en['workout.logSet'].replace('{n}', 1)).click();
      await btnNamed(p, en['workout.finishWorkout']).click();
      await p.getByRole('button', { name: new RegExp(`^(${en['workout.save']}|${en['workout.saveShort']})$`) }).click();
      await p.getByRole('heading', { name: en['finish.title'] }).waitFor({ timeout: 5000 });
    },
  },
  { name: 'empty week on Plan', route: '/plan', data: restWeek },
  { name: 'beginner: session 1 of 6', route: '/', data: (d) => ({ ...d, workouts: [], settings: { ...d.settings, training: { ...d.settings?.training, level: 'beginner' } } }) },
  { name: 'quests off: Home', route: '/', data: (d) => ({ ...d, settings: { ...d.settings, modules: { ...d.settings?.modules, quests: false } } }) },
  { name: 'safety limits on: Home', route: '/', data: gated },
  { name: 'safety limits on: Meals', route: '/meals', data: gated },
  { name: 'text 130%: Home', route: '/', font: '130%' },
  { name: 'text 130%: Workout', route: '/workout', font: '130%' },
  { name: 'text 130%: Meals', route: '/meals', font: '130%', act: toFullMeals },
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
async function measure(page, errors, key, shot) {
  await page.addScriptTag({ content: AXE });
  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return r.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }));
  });
  const taps = await page.evaluate(smallTaps, MIN_TAP);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const errs = errors.splice(0);
  if (process.env.E2E_VERBOSE) {
    console.log(key, errs.join(' | '));
    if (process.env.E2E_VERBOSE === '2') {
      if (taps) console.log('  taps:', (await page.evaluate(smallTaps, { min: MIN_TAP, detail: true })).join('; '));
      const nodes = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2aa'] } })).violations.flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target.join(' ')} ${n.any[0]?.message?.slice(0, 90) || ''}`)));
      if (nodes.length) console.log('  axe:', nodes.join('\n       '));
    }
  }
  if (shot) {
    mkdirSync(new URL('./out/', HERE), { recursive: true });
    await page.screenshot({ path: new URL(`./out/${FLAVOR}-${shot}.png`, HERE).pathname, fullPage: true });
  }
  return {
    axe: axe.reduce((n, v) => n + v.nodes, 0),
    rules: Object.fromEntries(axe.map((v) => [v.id, v.nodes])),
    taps,
    overflow: overflow ? 1 : 0,
    errors: errs.length,
  };
}

export async function run({ shots = false } = {}) {
  const server = await serve();
  const browser = await chromium.launch();
  const report = {};
  try {
    // E2E_STATES_ONLY=1 skips the routes, for working on the states.
    for (const dir of process.env.E2E_STATES_ONLY ? [] : DIRS) {
      const raw = structuredClone(FIXTURE);
      raw.profile = { ...(raw.profile || {}), locale: dir === 'rtl' ? 'ar' : 'en' };
      // The fixture person has answered the safety check with no limits
      // (SAFE-1), so the screens under test are the app, not the check.
      raw.safety = SCREENED;
      for (const width of WIDTHS) {
        const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce', colorScheme: 'dark', bypassCSP: true });
        await ctx.clock.setFixedTime(NOW);
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
          report[key] = await measure(page, errors, key, shots && `${route.replace(/\W+/g, '_') || 'home'}-${width}-${dir}`);
        }
        await ctx.close();
      }
    }
    for (const state of STATES) {
      for (const width of STATE_WIDTHS) {
        const raw = structuredClone(FIXTURE);
        const data = state.data ? state.data(raw) : raw;
        const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce', colorScheme: 'dark', bypassCSP: true });
        await ctx.clock.setFixedTime(NOW);
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
          await page.waitForTimeout(500);
        } catch (err) {
          // A state that can't be reached counts as an error, not a crash of the run.
          errors.push(`could not open: ${err.message.split('\n')[0]}`);
        }
        report[key] = await measure(page, errors, key, shots && `state-${state.name.replace(/\W+/g, '_')}-${width}`);
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    stop(server);
  }
  return report;
}

const CHECKS = ['axe', 'taps', 'overflow', 'errors'];

export function compare(now, base) {
  const worse = [];
  for (const [key, row] of Object.entries(now)) {
    const was = base[key] || {};
    for (const c of CHECKS) if (row[c] > (was[c] ?? 0)) worse.push(`${key}: ${c} ${was[c] ?? 0} -> ${row[c]}${c === 'axe' ? ` ${JSON.stringify(row.rules)}` : ''}`);
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
