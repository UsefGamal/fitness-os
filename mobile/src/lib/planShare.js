// Share or print the week: plain text for a message to your trainer, and a
// one-page HTML file that prints cleanly (open it in a browser, Print, Save
// as PDF). Pure helpers, tested in planShare.test.js.
import { longWeekday } from './dates.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** `days`: [{ date, day: effective plan day | null, evening: option | null }]. */
export function weekText(days, { title = 'My training week', time = '07:00', eveningTime = '20:00' } = {}) {
  const lines = [title, ''];
  for (const { date, day, evening } of days) {
    if (!day) {
      lines.push(`${longWeekday(date)}: rest${evening ? ` · ${evening.label} at ${eveningTime}` : ''}`, '');
      continue;
    }
    lines.push(`${longWeekday(date)}: ${day.label} at ${time}${evening ? ` · ${evening.label} at ${eveningTime}` : ''}`);
    for (const ex of day.exercises) lines.push(`  • ${ex.name}: ${ex.sets} × ${ex.reps}${ex.rest ? `, rest ${ex.rest}` : ''}${ex.rir ? `, RIR ${ex.rir}` : ''}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

/** A printable page. `photoOf(name)` gives an image URL (a data: URL in the
 * saved file) or null.
 * @param {any[]} days
 * @param {{ title?: string, time?: string, eveningTime?: string, tempo?: string, photoOf?: (name: string) => string | null }} [opts] */
export function weekHtml(days, { title = 'My training week', time = '07:00', eveningTime = '20:00', tempo = '', photoOf = () => null } = {}) {
  const blocks = days.map(({ date, day, evening }) => {
    const night = evening ? `<span class="night">${esc(evening.label)} at ${esc(eveningTime)}</span>` : '';
    if (!day) return `<section class="rest"><h2>${esc(longWeekday(date))} <small>Rest</small>${night}</h2></section>`;
    const rows = day.exercises.map((ex) => {
      const img = photoOf(ex.name);
      return `<tr><td class="ph">${img ? `<img src="${esc(img)}" alt="">` : ''}</td><td>${esc(ex.name)}</td><td>${esc(ex.sets)} × ${esc(ex.reps)}</td><td>${esc(ex.rest || '')}</td><td>${esc(ex.rir || '')}</td></tr>`;
    }).join('');
    return `<section><h2>${esc(longWeekday(date))} <small>${esc(day.label)} · ${esc(time)}</small>${night}</h2><table><thead><tr><th></th><th>Exercise</th><th>Sets × reps</th><th>Rest</th><th>RIR</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
body{font:13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:16px;max-width:780px}
h1{font-size:20px;margin:0 0 2px}p.sub{color:#555;margin:0 0 12px}
section{break-inside:avoid;margin:0 0 10px}h2{font-size:14px;margin:0 0 4px;display:flex;gap:8px;align-items:baseline}
h2 small{color:#555;font-weight:500}.night{margin-left:auto;font-size:12px;color:#1a7f37}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:3px 6px;border-bottom:1px solid #ddd;vertical-align:middle}
th{font-size:11px;color:#555;font-weight:600}td.ph{width:40px;padding:2px}td.ph img{width:40px;height:28px;object-fit:cover;border-radius:3px;display:block}
.rest h2{color:#555}@media print{body{margin:0}@page{margin:12mm}}
</style></head><body><h1>${esc(title)}</h1><p class="sub">${tempo ? `Tempo ${esc(tempo)} · ` : ''}Made with Fitness OS</p>${blocks}</body></html>`;
}
