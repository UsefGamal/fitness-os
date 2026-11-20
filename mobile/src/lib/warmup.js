// Warm-up sets for the first lift of a muscle today (set kinds round 2,
// 20 Nov 2026). A barbell lift gets the plate-friendly ramp from
// lib/plates.js; a dumbbell, cable or machine lift gets two lighter sets
// (about half for 10, three quarters for 5). Bodyweight moves and holds get
// none. Warm-ups are logged as set_type 'warmup', so they never count
// toward weekly sets, volume or records (lib/data.js isWorkSet). Pure;
// tests in warmup.test.js.
import { warmupSets } from './plates.js';

const LIGHT = [[0.5, 10], [0.75, 5]];

/** The warm-up sets before `workKg`: [{ kg, reps }], lightest first, every
 * one below the work weight. `step` rounds a non-barbell load (2 kg for
 * dumbbells, lib/progression.js stepFor).
 * @param {{ workKg: number, barbell?: boolean, barKg?: number, plates?: number[], step?: number }} o
 * @returns {{ kg: number, reps: number }[]} */
export function warmupPlan({ workKg, barbell = false, barKg = 20, plates, step = 2.5 }) {
  if (!(workKg > 0)) return [];
  if (barbell) return warmupSets(workKg, barKg, plates).map(({ kg, reps }) => ({ kg, reps }));
  const out = [];
  const s = step > 0 ? step : 2.5;
  for (const [pct, reps] of LIGHT) {
    const kg = Math.round((workKg * pct) / s) * s;
    if (kg <= 0 || kg >= workKg) continue;
    if (out.length && out[out.length - 1].kg === kg) continue;
    out.push({ kg: +kg.toFixed(2), reps });
  }
  return out;
}

/** Is exercise `i` the first today for at least one of its main muscles?
 * `targets[j]` is exercise j's { main, helpers } in today's order (or
 * null when unknown). An earlier exercise warms its main muscles and its
 * helpers. With no target, only the day's first exercise counts as first.
 * @param {Array<{ main: string[], helpers?: string[] } | null>} targets
 * @param {number} i */
export function firstForMuscles(targets, i) {
  const own = targets[i];
  if (!own || !own.main?.length) return i === 0;
  const warm = new Set();
  for (const t of targets.slice(0, i)) {
    if (!t) continue;
    for (const m of t.main || []) warm.add(m);
    for (const m of t.helpers || []) warm.add(m);
  }
  return own.main.some((m) => !warm.has(m));
}
