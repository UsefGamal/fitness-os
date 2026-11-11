// Exercise levels. Every catalogue exercise carries a level (beginner,
// intermediate, expert); a person picks theirs in setup or Settings.
// Exercises above it are only labelled "Advanced": nothing is hidden or
// locked (Yusuf, 11 Nov 2026). Swap lists put same-level options first.
import { canDo } from './equipment.js';
import { alternatives } from './similar.js';

export const LEVELS = ['beginner', 'intermediate', 'expert'];
const RANK = { beginner: 0, intermediate: 1, expert: 2 };

/** The level a setup answer means: 'some' experience is intermediate. */
export function levelFromSetup(experience) {
  return experience === 'some' ? 'intermediate' : 'beginner';
}

/** Is an exercise above the person's level? Never when either is unknown. */
export function isAdvanced(entryLevel, userLevel) {
  if (!(entryLevel in RANK) || !(userLevel in RANK)) return false;
  return RANK[entryLevel] > RANK[userLevel];
}

/** Same-muscle replacements for `entry`, as [{ entry, score, advanced,
 * doable }]: what the person's equipment allows first, then exercises at
 * their level, then the closest match. `owned` is equipment.js ownedKinds
 * (null = a full gym). Names in `skip` (already in the session) are left out. */
export function swapOptions(entry, entries, { level = null, owned = null, skip = [], limit = 12 } = {}) {
  const taken = new Set(skip.map((n) => String(n).toLowerCase()));
  return alternatives(entry, entries)
    .filter((r) => !taken.has(r.entry.name.toLowerCase()))
    .map((r) => ({ entry: r.entry, score: r.score, advanced: isAdvanced(r.entry.level, level), doable: canDo(r.entry, owned) }))
    .sort((a, b) => b.doable - a.doable || a.advanced - b.advanced || b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit);
}
