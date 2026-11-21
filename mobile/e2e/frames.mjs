import { chromium } from 'playwright';
const [file, out, mode, theme, step] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.DSF || 1) });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('file://' + file + '#record');
await p.addStyleTag({ content: 'body{padding:0!important;margin:0!important}.wrap{max-width:none!important;gap:0!important}.wrap>*:not(.stage-box){display:none!important}.stage-box{border-radius:0!important;box-shadow:none!important}' });
await p.evaluate(([m, t]) => window.__demo.set(m, t), [mode, theme]);
await p.waitForTimeout(200);
const total = await p.evaluate(() => window.__demo.total());
const st = Number(step);
const pre = Number(process.env.PREFIX_I || 0);
let i = pre;
const end = Number(process.env.END_MS || total);
for (let ms = 0; ms <= end + 0.1; ms += st) {
  await p.evaluate((x) => window.__demo.seek(x), ms);
  await p.screenshot({ path: `${out}/f${String(i++).padStart(4, '0')}.png` });
}
console.log('frames', i - pre, 'total', total);
await b.close();
