// Workouts built from the equipment you have. Settings keeps the equipment
// kinds you own (null = a full gym); "Build a session" swaps each plan
// exercise you can't do for the closest same-muscle one you can. Pure
// helpers, tested in equipment.test.js.
import { entryFor } from './catalogue.js';
import { alternatives, clusterOf } from './similar.js';

// What you can tick; bodyweight is always possible.
export const KINDS = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Kettlebell & bands', 'Other'];
export const PRESETS = [
  { key: 'gym', label: 'Full gym', kinds: null },
  { key: 'home', label: 'Home: dumbbells and bands', kinds: ['Dumbbell', 'Kettlebell & bands'] },
  { key: 'hotel', label: 'Bodyweight only', kinds: [] },
];

/** null when everything is available. */
export function ownedKinds(training) {
  return Array.isArray(training?.equipment) ? training.equipment : null;
}

export function canDo(entry, owned) {
  if (!owned) return true;
  const c = clusterOf(entry.equipment);
  return c === 'Bodyweight' || owned.includes(c);
}

/** Each plan exercise as { orig, name, status: 'keep' | 'swap' | 'none'
 * | 'unknown', to?: catalogue entry }. 'unknown' means the catalogue has no
 * match to judge it by, so it stays. */
export function buildSession(day, { training, catalogue, owned }) {
  // Names already in the session, so two exercises don't turn into the same one.
  const used = new Set(day.exercises.map((ex) => ex.name.toLowerCase()));
  return day.exercises.map((ex, orig) => {
    const base = { orig, name: ex.name };
    if (!owned) return { ...base, status: 'keep' };
    const entry = catalogue ? entryFor(ex.name, training, catalogue.byId) : null;
    if (!entry) return { ...base, status: 'unknown' };
    if (canDo(entry, owned)) return { ...base, status: 'keep' };
    const doable = alternatives(entry, catalogue.exercises, { minScore: 0.3 }).filter((r) => canDo(r.entry, owned));
    const best = doable.find((r) => !used.has(r.entry.name.toLowerCase())) || doable[0];
    if (!best) return { ...base, status: 'none' };
    used.add(best.entry.name.toLowerCase());
    return { ...base, status: 'swap', to: best.entry, score: best.score };
  });
}

/** The swaps of a build, as tweaks.swaps ({ orig: name }). */
export function buildSwaps(build) {
  return Object.fromEntries(build.filter((b) => b.status === 'swap').map((b) => [b.orig, b.to.name]));
}
