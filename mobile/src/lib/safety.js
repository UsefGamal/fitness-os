// The safety check (SAFE-1; PRODUCT.md "Stay safe"). One screen of yes/no
// questions at setup and in Settings. The answers are never stored: only
// the limits ("gates") they switch on. Skipping the check counts as gated,
// never as "all clear". Every gate is read through gateOn(), so one place
// decides what a gate means:
//
//   no_deficit          calories stay at maintenance, never a cut
//   no_fasting_deficit  no deficit while fasting in Ramadan (lib/ramadan.js)
//   protein_cap         protein at most 1.2 g per kg
//   beginner_only       beginner labels and easier sets only
//   needs_clearance     "check with your doctor first" note
//
// Under 18 is worked out from the birth date every time, not from an
// answer, so it can't be skipped or go stale. Pure; safety.test.js.
import { daysBetween } from './dates.js';

export const SCREEN_VERSION = 1;
export const ADULT_YEARS = 18;
export const PROTEIN_CAP_G_PER_KG = 1.2;
export const GATES = ['no_deficit', 'no_fasting_deficit', 'protein_cap', 'beginner_only', 'needs_clearance'];

/** The questions, in the order asked. A "yes" switches on `gates` and the
 * `hides` switches (hide_weight, hide_kcal). The wording is in i18n under
 * safety.q.<key>. */
export const QUESTIONS = [
  { key: 'pregnant', gates: ['no_deficit', 'no_fasting_deficit'], hides: [] },
  { key: 'eating', gates: ['no_deficit'], hides: ['hide_weight', 'hide_kcal'] },
  { key: 'kidney', gates: ['protein_cap'], hides: [] },
  { key: 'heart', gates: ['needs_clearance', 'beginner_only'], hides: [] },
  { key: 'diabetes', gates: ['no_fasting_deficit', 'needs_clearance'], hides: [] },
  { key: 'bp_meds', gates: ['needs_clearance'], hides: [] },
  { key: 'injury', gates: ['beginner_only'], hides: [] },
];

const allGates = (on) => Object.fromEntries(GATES.map((g) => [g, on]));

/** Every question answered yes or no? */
export function answeredAll(answers) {
  return QUESTIONS.every((q) => typeof answers?.[q.key] === 'boolean');
}

/** What the answers switch on: { gates, hides }. A question left without
 * an answer counts as "yes" (skipped = gated). */
export function screeningResult(answers = {}) {
  const gates = allGates(false);
  const hides = [];
  for (const q of QUESTIONS) {
    if (answers?.[q.key] === false) continue;
    for (const g of q.gates) gates[g] = true;
    for (const h of q.hides) if (!hides.includes(h)) hides.push(h);
  }
  return { gates, hides };
}

/** Save the check. Only flags land in the data. The hide switches are the
 * person's own: the check can turn them on, never off. */
export function applyScreening(data, answers, today) {
  const { gates, hides } = screeningResult(answers);
  const old = data.safety || {};
  const next = { ...old, screen_version: SCREEN_VERSION, screened_on: today, skipped: false, gates: { ...(old.gates || {}), ...gates } };
  for (const h of hides) next[h] = true;
  if (!gates.needs_clearance) delete next.clearance_seen;
  return { ...data, safety: next };
}

/** "Not now": every limit on and calories hidden (kcalHidden), until the
 * check is done. */
export function skipScreening(data, today) {
  const old = data.safety || {};
  return { ...data, safety: { ...old, screen_version: SCREEN_VERSION, screened_on: today, skipped: true, gates: { ...(old.gates || {}), ...allGates(true) } } };
}

/** Are calorie numbers hidden? By the person's switch, or while the check
 * is skipped (flagged or unscreened people see no kcal). */
export function kcalHidden(data) {
  return data?.safety?.hide_kcal === true || data?.safety?.skipped === true;
}

/** Has this data never met the check (older installs, older backups)? The
 * app then asks before anything else. First-time setup asks it itself. */
export function needsScreening(data) {
  return Boolean(data) && data.safety?.screen_version == null;
}

/** Under 18 today, from the profile's birth date. False when unknown. */
export function isMinorNow(data, today) {
  const dob = data?.profile?.date_of_birth;
  if (!dob || !today) return false;
  const age = daysBetween(dob, today) / 365.25;
  return age >= 0 && age < ADULT_YEARS;
}

/** Is this limit on today? Under 18 switches on no_deficit and
 * beginner_only whatever the answers were. */
export function gateOn(data, gate, today) {
  if (data?.safety?.gates?.[gate] === true) return true;
  return (gate === 'no_deficit' || gate === 'beginner_only') && isMinorNow(data, today);
}

/** The limits that are on today, in GATES order. */
export function gatesOn(data, today) {
  return GATES.filter((g) => gateOn(data, g, today));
}

/** The goal direction the calorie maths may use: a cut (lose, recomp)
 * becomes 'maintain' while no_deficit is on. */
export function safeMode(data, mode, today) {
  return (mode === 'lose' || mode === 'recomp') && gateOn(data, 'no_deficit', today) ? 'maintain' : mode;
}

/** Goal directions Profile may offer today. */
export function allowedDirections(data, directions, today) {
  return gateOn(data, 'no_deficit', today) ? directions.filter((d) => d !== 'lose' && d !== 'recomp') : directions;
}

/** Protein in grams after the cap, when the cap is on. */
export function capProtein(data, proteinG, weightKg, today) {
  if (!gateOn(data, 'protein_cap', today) || !(weightKg > 0)) return proteinG;
  return Math.min(proteinG, Math.round(weightKg * PROTEIN_CAP_G_PER_KG));
}

export const GENTLE_RIR = 3;

/** Reps left in the tank, never under 3: '1-2' -> '3', '2-4' -> '3-4',
 * none -> '3'. So no set is taken close to failure. */
export function gentleRir(rir) {
  const nums = String(rir ?? '').match(/\d+/g)?.map(Number) || [];
  if (!nums.length) return String(GENTLE_RIR);
  const lo = Math.max(GENTLE_RIR, nums[0]);
  const hi = Math.max(lo, nums[nums.length - 1]);
  return lo === hi ? String(lo) : `${lo}-${hi}`;
}

/** A plan day as it is shown and run while beginner_only is on: every
 * exercise stops at least 3 reps short of failure. The saved plan is not
 * changed. */
export function gentleDay(data, day, today) {
  if (!day || !gateOn(data, 'beginner_only', today)) return day;
  return { ...day, gentle: true, exercises: day.exercises.map((e) => ({ ...e, rir: gentleRir(e.rir) })) };
}

/** May the app cheer a lower weight (badges, "kg down")? Not while weight
 * is hidden or a cut is off. */
export function celebratesWeightLoss(data, today) {
  return data?.safety?.hide_weight !== true && !gateOn(data, 'no_deficit', today);
}

/** Show the "check with your doctor" note? Until the person says they have. */
export function showClearance(data, today) {
  return gateOn(data, 'needs_clearance', today) && data?.safety?.skipped !== true && data?.safety?.clearance_seen !== true;
}

export function markClearanceSeen(data) {
  return { ...data, safety: { ...(data.safety || {}), clearance_seen: true } };
}

/** The person's own switches (Settings): 'hide_weight' | 'hide_kcal'. */
export function setHide(data, key, on) {
  if (key !== 'hide_weight' && key !== 'hide_kcal') return data;
  return { ...data, safety: { ...(data.safety || {}), [key]: Boolean(on) } };
}

/** One word for the Settings row: 'none' (never asked), 'skipped',
 * 'limits' (answered, some limit on) or 'clear'. */
export function screeningState(data, today) {
  if (needsScreening(data)) return 'none';
  if (data.safety?.skipped) return 'skipped';
  return gatesOn(data, today).length ? 'limits' : 'clear';
}
