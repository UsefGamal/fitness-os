// Monkey test: on every route, tap each visible button, link, switch and
// tab one at a time, each from a fresh copy of the harness person's data,
// at 360 px in Cairo time with no network. After the tap it also taps up
// to six buttons in a sheet that opened. Reports any crash screen, page
// error, native dialog or page that scrolls sideways.
//
//   npm run build && node e2e/monkey.mjs            every route (slow: ~2 s a tap)
//   node e2e/monkey.mjs /plan /meals                only these routes
//   PORT=4300 node e2e/monkey.mjs ...               run several side by side
//
// Exits 1 when something was found. Taps that leave the app (Back on a
// page opened directly, with no history) are not counted.
import { spawn } from 'node:child_process';

import { chromium } from 'playwright';

import en from '../src/i18n/en.js';
import { harnessPerson } from './harnessPerson.mjs';
import { ROUTES } from './harness.mjs';

const PORT = Number(process.env.PORT || 4191);
const URL0 = `http://localhost:${PORT}/`;
const NOW = new Date(process.env.NOW || '2026-11-08T07:00:00Z');
const EXTRA = ['/plan/checkin', '/meals/library', '/stats/fitness-test', '/follow', '/settings/look', '/settings/nutrition', '/settings/reminders'];
const only = process.argv.slice(2).filter((a) => a.startsWith('/'));
const routes = only.length ? only : [...ROUTES, ...EXTRA];
const SEL = 'button:visible, a[href]:visible, [role=switch]:visible, [role=tab]:visible';
const DATA = JSON.stringify(harnessPerson());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn('npx', ['vite', 'preview', '--outDir', 'dist', '--port', String(PORT), '--strictPort'], { cwd: new URL('..', import.meta.url), stdio: 'ignore', detached: true });
for (let i = 0; i < 100; i += 1) {
  try { if ((await fetch(URL0)).ok) break; } catch { /* not up yet */ }
  await sleep(200);
}
const browser = await chromium.launch();
const findings = [];

async function open(route) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, reducedMotion: 'reduce', timezoneId: 'Africa/Cairo', locale: 'en-GB', acceptDownloads: true });
  await ctx.clock.install({ time: NOW });
  await ctx.addInitScript((d) => {
    if (document.cookie.includes('seeded=1')) return;
    document.cookie = 'seeded=1; path=/';
    localStorage.setItem('fitness-os-data-v1', d);
  }, DATA);
  await ctx.route((u) => !u.href.startsWith(URL0), (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => { if (page.url().startsWith(URL0)) errs.push(e.message); });
  page.on('dialog', (d) => { errs.push(`native dialog: ${d.message()}`); d.dismiss(); });
  await page.goto(`${URL0}#${route}`);
  await page.locator('#root > *').first().waitFor({ timeout: 15000 });
  await page.clock.runFor(4000);
  await page.waitForTimeout(200);
  return { ctx, page, errs };
}

const state = (page) => page.evaluate((crash) => ({
  inApp: location.protocol.startsWith('http'),
  crash: document.body.innerText.includes(crash),
  over: document.documentElement.scrollWidth > window.innerWidth + 1,
}), en['crash.title']).catch(() => ({ inApp: false, crash: false, over: false }));

async function settle(page, ms) {
  await page.clock.runFor(ms);
  await page.waitForTimeout(100);
}

for (const route of routes) {
  let { ctx, page, errs } = await open(route);
  const labels = await page.locator(SEL).evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') || e.innerText || e.title || '').trim().replace(/\s+/g, ' ').slice(0, 50)));
  const first = await state(page);
  if (errs.length || first.crash || first.over) findings.push({ route, tap: '(open)', ...first, errs: [...errs] });
  await ctx.close();
  console.log(`${route}: ${labels.length} taps`);
  for (let i = 0; i < labels.length; i += 1) {
    ({ ctx, page, errs } = await open(route));
    try {
      await page.locator(SEL).nth(i).click({ timeout: 2000 });
      await settle(page, 1500);
      const st = await state(page);
      let second = null;
      const sheet = page.locator('[role=dialog] button:visible');
      const n = Math.min(await sheet.count(), 6);
      for (let j = 0; j < n && st.inApp; j += 1) {
        const label = await sheet.nth(j).innerText({ timeout: 500 }).catch(() => '');
        try {
          await sheet.nth(j).click({ timeout: 800 });
          await settle(page, 800);
        } catch { /* gone or covered: try the next one */ }
        if ((await state(page)).crash || errs.length) { second = label; break; }
      }
      const after = await state(page);
      if (st.inApp && (errs.length || st.crash || st.over || after.crash)) findings.push({ route, tap: labels[i], second, ...st, crashAfter: after.crash, errs: [...errs] });
    } catch { /* not tappable once the page settled */ }
    await ctx.close();
  }
}
await browser.close();
try { process.kill(-server.pid); } catch { server.kill(); }
console.log(findings.length ? JSON.stringify(findings, null, 1) : `Monkey: ${routes.length} routes, nothing found.`);
process.exit(findings.length ? 1 : 0);
