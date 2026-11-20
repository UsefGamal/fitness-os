import { chromium } from 'playwright';
import { harnessPerson } from './harnessPerson.mjs';
import { SCREENED } from './bigFixture.mjs';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', colorScheme: theme, bypassCSP: true });
  await ctx.clock.setFixedTime(new Date('2026-11-06T07:30:00'));
  const d = harnessPerson();
  d.safety = SCREENED;
  d.settings = { ...d.settings, theme, tour: { done_on: '2026-11-01' } };
  await ctx.addInitScript(([k, v]) => { localStorage.setItem(k, v); }, ['fitness-os-data-v1', JSON.stringify(d)]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('err', e.message));
  await page.goto('http://localhost:4173/#/');
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '.fanfare,.intro,.toast,.sheet,.scrim,.tour,.popup-dim,.sheet-wrap,.sheet-backdrop{display:none!important}' });
  await page.waitForTimeout(300);
  console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => ['fixed','absolute'].includes(getComputedStyle(e).position) && e.offsetWidth > 300).map(e => e.className).join(' | ')));
  await page.screenshot({ path: `${out}/home-${theme}.png` });
  const box = await page.locator('.wordmark').boundingBox();
  console.log(theme, JSON.stringify(box), await page.evaluate(() => getComputedStyle(document.querySelector('.wordmark')).fontSize));
  await ctx.close();
}
await browser.close();
