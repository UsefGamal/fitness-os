// Play Store phone screenshots (PLAY-1): 1080 x 1920 (360 x 640 at 3x), dark.
// npm run build, npx vite preview, then: node e2e/shot-play.mjs OUT_DIR [dark|light]
import { chromium } from 'playwright';
import { harnessPerson } from './harnessPerson.mjs';
import { SCREENED } from './bigFixture.mjs';
const out = process.argv[2];
const theme = process.argv[3] || 'dark';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const shots = [['1-home', '/'], ['2-plan', '/plan'], ['3-workout', '/workout'], ['4-meals', '/meals'], ['5-shopping', '/shopping'], ['6-stats', '/stats'], ['7-library', '/library'], ['8-privacy', '/settings/privacy']];
for (const [name, route] of shots) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, reducedMotion: 'reduce', colorScheme: theme, bypassCSP: true });
  await ctx.clock.setFixedTime(new Date('2026-11-08T07:30:00'));
  const d = harnessPerson();
  d.safety = SCREENED;
  d.settings = { ...d.settings, theme, tour: { done_on: '2026-11-01' } };
  await ctx.addInitScript(([k, v]) => { localStorage.setItem(k, v); }, ['fitness-os-data-v1', JSON.stringify(d)]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('err', e.message));
  await page.goto(`http://localhost:4173/#${route}`);
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '.fanfare,.intro,.toast,.tour,.popup-dim,.sheet,.scrim,.sheet-wrap,.sheet-backdrop{display:none!important}' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/phone-${name}.png` });
  await ctx.close();
}
await browser.close();
