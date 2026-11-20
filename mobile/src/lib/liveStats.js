// The live strip at the top of a running workout (BeFit idea B2): time,
// volume and a rough calorie figure.
import { isWorkSet } from './data.js';

// Resistance training, a general effort: about 5 METs (Compendium of
// Physical Activities, code 02054). Rough on purpose: it's shown as "about".
const STRENGTH_MET = 5;
// Without a weigh-in yet, a middle weight.
const DEFAULT_KG = 75;

/** Kilograms moved in work sets: weight × reps. Warm-ups and timed holds
 * don't count.
 * @param {Array<{ weight_kg?: number|null, reps?: number|null, track?: string, set_type?: string, is_warmup?: boolean }>} sets */
export function workoutVolume(sets) {
  let kg = 0;
  for (const s of sets || []) {
    if (!isWorkSet(s) || s.track === 'time') continue;
    kg += (Number(s.weight_kg) || 0) * (Number(s.reps) || 0);
  }
  return Math.round(kg);
}

/** About how many kcal so far: METs × body weight × hours of active time.
 * @param {number} activeMs @param {number|null|undefined} bodyKg */
export function workoutKcal(activeMs, bodyKg) {
  const kg = bodyKg && bodyKg > 0 ? bodyKg : DEFAULT_KG;
  const hours = Math.max(0, activeMs || 0) / 3600000;
  return Math.round(STRENGTH_MET * kg * hours);
}

/** "mm:ss", or "h:mm:ss" past an hour. @param {number} ms */
export function stopwatch(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/** The rows of the set table for one exercise: the sets logged so far, then
 * one open row per set still planned. The first open row is the one you log
 * next. Rows are numbered by the plan's sets: a warm-up or drop set has no
 * number (n null) and doesn't use up a planned row.
 * @template S @param {S[]} logged @param {number} planned
 * @returns {Array<{ kind: 'done', set: S, n: number | null } | { kind: 'open', n: number, next: boolean }>} */
export function setRows(logged, planned) {
  /** @type {Array<{ kind: 'done', set: S, n: number | null } | { kind: 'open', n: number, next: boolean }>} */
  const rows = [];
  let n = 0;
  for (const set of logged || []) {
    const counts = set && typeof set === 'object' ? plannedSet(/** @type {any} */ (set)) : true;
    if (counts) n += 1;
    rows.push({ kind: /** @type {'done'} */ ('done'), set, n: counts ? n : null });
  }
  const open = Math.max(0, (planned || 0) - n);
  for (let k = 0; k < open; k += 1) rows.push({ kind: 'open', n: n + k + 1, next: k === 0 });
  return rows;
}

/** Does a logged set fill one of the plan's sets? Warm-ups and drop sets
 * are extras on top of the plan, so they don't (a drop set still counts
 * half toward weekly sets, lib/data.js hardSetValue).
 * @param {{ is_warmup?: boolean, set_type?: string }} set */
export function plannedSet(set) {
  return isWorkSet(set) && set.set_type !== 'drop';
}

/** Text typed into a reps or kg box, as a number: commas count as points,
 * anything unreadable or negative is null.
 * @param {string} text @param {{ max?: number, whole?: boolean }} [opts] */
export function readNumber(text, { max = 1000, whole = false } = {}) {
  const n = Number(String(text ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || String(text ?? '').trim() === '') return null;
  const v = Math.min(max, whole ? Math.round(n) : Math.round(n * 100) / 100);
  return v;
}
