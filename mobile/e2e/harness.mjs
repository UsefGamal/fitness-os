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

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const HERE = new URL('.', import.meta.url);
// P14-02: each APK has its own counts. FITNESS_OS_FLAVOR=friends checks the
// build the friends install, against e2e/baseline-friends.json.
const FLAVOR = process.env.FITNESS_OS_FLAVOR === 'friends' ? 'friends' : 'yusuf';
const BASELINE = new URL(FLAVOR === 'friends' ? './baseline-friends.json' : './baseline.json', HERE);
const FIXTURE = JSON.parse(readFileSync(new URL('../src/lib/fixtures/v1-yusuf-like.json', HERE), 'utf8'));
const KEY = 'fitness-os-data-v1';
const PORT = 4179;

export const ROUTES = ['/', '/plan', '/plan/routines', '/plan/mine', '/workout', '/meals', '/stats', '/history', '/library', '/settings', '/shopping', '/quests', '/profile', '/snapshots', '/photos', '/intervals', '/session/home', '/session/recovery'];
export const WIDTHS = [360, 390, 412];
export const DIRS = ['ltr', 'rtl'];
export const MIN_TAP = 44;

/** Interactive elements under 44 x 44, measured in the page. Inline links
 * inside a sentence are left out (WCAG 2.5.8 exempts them). */
function smallTaps(min) {
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
    if (r.width + grow < min || r.height + grow < min) n += 1;
  }
  return n;
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

export async function run({ shots = false } = {}) {
  const server = await serve();
  const browser = await chromium.launch();
  const report = {};
  try {
    for (const dir of DIRS) {
      const raw = structuredClone(FIXTURE);
      raw.profile = { ...(raw.profile || {}), locale: dir === 'rtl' ? 'ar' : 'en' };
      for (const width of WIDTHS) {
        const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce', colorScheme: 'dark', bypassCSP: true });
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
          await page.addScriptTag({ content: AXE });
          const axe = await page.evaluate(async () => {
            const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
            return r.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }));
          });
          const taps = await page.evaluate(smallTaps, MIN_TAP);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
          const key = `${route} ${width} ${dir}`;
          if (process.env.E2E_VERBOSE) console.log(key);
          report[key] = {
            axe: axe.reduce((n, v) => n + v.nodes, 0),
            rules: Object.fromEntries(axe.map((v) => [v.id, v.nodes])),
            taps,
            overflow: overflow ? 1 : 0,
            errors: errors.splice(0).length,
          };
          if (shots) {
            mkdirSync(new URL('./out/', HERE), { recursive: true });
            await page.screenshot({ path: new URL(`./out/${FLAVOR}-${route.replace(/\W+/g, '_') || 'home'}-${width}-${dir}.png`, HERE).pathname, fullPage: true });
          }
        }
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
