// Plate maths and warm-up sets for barbell lifts. Pure helpers.

export const BARS = { olympic: { label: 'Olympic bar', kg: 20 }, womens: { label: "Women's bar", kg: 15 }, ez: { label: 'EZ bar', kg: 10 }, smith: { label: 'Smith machine', kg: 15 } };
export const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export function defaultPlates() {
  return { bar: 'olympic', owned: [...ALL_PLATES] };
}

const r2 = (n) => Math.round(n * 100) / 100;

/** Plates for one side to load `total` kg on `barKg`, biggest first, using
 * any number of each size owned. { plates, loaded, exact }: when `total`
 * can't be made, the heaviest weight that can, at or under it. */
export function platesPerSide(total, barKg, owned = ALL_PLATES) {
  const sizes = [...owned].sort((a, b) => b - a);
  let side = r2((total - barKg) / 2);
  const plates = [];
  if (side > 0) {
    for (const p of sizes) {
      while (side >= p - 1e-9) {
        plates.push(p);
        side = r2(side - p);
      }
    }
  }
  const loaded = r2(barKg + 2 * plates.reduce((n, p) => n + p, 0));
  return { plates, loaded, exact: Math.abs(loaded - total) < 1e-6 };
}

/** The nearest weight that can be loaded (ties go down). */
export function nearestLoadable(total, barKg, owned = ALL_PLATES) {
  if (total <= barKg || !owned.length) return barKg;
  const down = platesPerSide(total, barKg, owned).loaded;
  const step = Math.min(...owned) * 2;
  const up = platesPerSide(down + step, barKg, owned).loaded;
  return total - down <= up - total ? down : up;
}

/** "2×20 + 2.5" style text for one side. */
export function plateText(plates) {
  const counts = [];
  for (const p of plates) {
    const last = counts[counts.length - 1];
    if (last && last[0] === p) last[1] += 1;
    else counts.push([p, 1]);
  }
  return counts.map(([p, n]) => (n > 1 ? `${n}×${p}` : `${p}`)).join(' + ') || 'Empty bar';
}

/** Warm-up sets before a working weight: about 40%, 60% and 80%, rounded
 * to what can be loaded, never below the empty bar, duplicates dropped. */
export function warmupSets(workKg, barKg, owned = ALL_PLATES) {
  if (!workKg || workKg <= barKg) return [];
  const steps = [[0.4, 8], [0.6, 5], [0.8, 3]];
  const out = [];
  for (const [pct, reps] of steps) {
    const kg = Math.max(barKg, nearestLoadable(workKg * pct, barKg, owned));
    if (kg >= workKg) continue;
    if (out.length && out[out.length - 1].kg === kg) continue;
    out.push({ kg, reps, pct: Math.round(pct * 100) });
  }
  return out;
}

/** Is this a barbell lift? By catalogue equipment, else by name. */
export function isBarbell(name, entry) {
  if (entry?.equipment) return entry.equipment === 'barbell' || entry.equipment === 'e-z curl bar';
  return /\b(barbell|bench press|back squat|front squat|deadlift|overhead press|bent-over row|hip thrust)\b/i.test(name || '');
}
