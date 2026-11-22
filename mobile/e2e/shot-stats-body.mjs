// Screenshots for the Stats Body + Badges rework (not part of CI).
import { chromium } from 'playwright';
import { harnessPerson } from './harnessPerson.mjs';
import { SCREENED } from './bigFixture.mjs';
import { addDays } from '../src/lib/dates.js';
const out = process.argv[2];
const T = '2026-11-06';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
function person(theme) {
  const d = harnessPerson();
  d.safety = SCREENED;
  d.settings = { ...d.settings, theme, tour: { done_on: '2026-11-01' }, health: { ...(d.settings.health || {}), enabled: true } };
  const extra = [[-12, 102.9, 98], [-10, 102.6], [-8, 102.8], [-5, 102.4, 97.5], [-3, 102.3], [-1, 102.1]];
  let id = Math.max(...d.body_logs.map((b) => b.id)) + 1;
  for (const [o, kg, w] of extra) d.body_logs.push({ id: id++, log_date: addDays(T, o), weight_kg: kg, waist_cm: w ?? null, notes: null, sleep_hours: null, chest_cm: null, arm_cm: null, hips_cm: null, thigh_cm: null });
  d.body_logs.sort((a, b) => (a.log_date < b.log_date ? -1 : 1));
  d.health_daily = {};
  for (let i = 0; i < 12; i += 1) d.health_daily[addDays(T, -i * 2)] = { steps: 3500 + ((i * 937) % 2400) };
  return d;
}
const shots = [
  ['1-body-top', '/stats?tab=body', 0],
  ['2-body-lower', '/stats?tab=body', 700],
  ['3-badges', '/stats?tab=badges', 0],
  ['4-weigh-ins', '/stats/body/weigh-ins', 0],
  ['5-measurements', '/stats/body/measurements', 0],
];
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 3, hasTouch: true, reducedMotion: 'reduce', colorScheme: theme });
  await ctx.clock.setFixedTime(new Date(`${T}T09:30:00`));
  await ctx.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('whats_new_seen', '9.9.9'); }, ['fitness-os-data-v1', JSON.stringify(person(theme))]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('err', e.message));
  for (const [name, route, y] of shots) {
    await page.goto(`http://localhost:4173/#${route}`);
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: '.fanfare,.intro,.toast,.tour,.popup-dim{display:none!important}' });
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${name}-${theme}.png` });
  }
  if (theme === 'dark') {
    await page.goto('http://localhost:4173/#/stats?tab=body');
    await page.waitForTimeout(1000);
    await page.addStyleTag({ content: '.fanfare,.intro,.toast,.tour{display:none!important}' });
    await page.getByRole('button', { name: 'Log', exact: true }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/6-log-sheet-${theme}.png` });
  }
  await ctx.close();
}
await browser.close();
