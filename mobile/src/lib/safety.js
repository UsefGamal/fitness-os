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
//   pregnancy_safe      pregnancy swaps: nothing on the back or belly,
//                       no crunches, nothing head down (safeDay)
//   nursing_extra       about 400 kcal a day more while breastfeeding
//   steady_carbs        diabetes note on Meals: carbs spread over meals
//
// An injury also asks where it hurts (INJURY_AREAS); the exercises that load
// those spots are swapped by safeDay (content/safety_swaps.py, SAFE-2).
//
// Under 18 is worked out from the birth date every time, not from an
// answer, so it can't be skipped or go stale. Pure; safety.test.js.
import { daysBetween } from './dates.js';

export const SCREEN_VERSION = 1;
export const ADULT_YEARS = 18;
export const PROTEIN_CAP_G_PER_KG = 1.2;
export const GATES = ['no_deficit', 'no_fasting_deficit', 'protein_cap', 'beginner_only', 'needs_clearance', 'pregnancy_safe', 'nursing_extra', 'steady_carbs'];
// Gates that only a real "yes" switches on. They add food or change the
// exercises, which nobody should get from a skipped or blank question.
const ANSWER_ONLY = new Set(['pregnancy_safe', 'nursing_extra', 'steady_carbs']);
/** The limits a skipped check switches on: every gate but those. */
export const SKIP_GATES = GATES.filter((g) => !ANSWER_ONLY.has(g));
export const NURSING_KCAL = 400;
export const INJURY_AREAS = ['shoulder', 'elbow_wrist', 'lower_back', 'hip', 'knee', 'ankle'];

/** The questions, in the order asked. A "yes" switches on `gates` and the
 * `hides` switches (hide_weight, hide_kcal). The wording is in i18n under
 * safety.q.<key>. */
export const QUESTIONS = [
  // Not asked when the sex is male (a male answer is "no"). Asked when the
  // sex is female or not given, since then nobody can rule it out.
  { key: 'pregnant', gates: ['no_deficit', 'no_fasting_deficit', 'pregnancy_safe', 'beginner_only'], hides: [], notFor: ['male'] },
  { key: 'breastfeeding', gates: ['no_deficit', 'no_fasting_deficit', 'nursing_extra'], hides: [], notFor: ['male'] },
  { key: 'eating', gates: ['no_deficit'], hides: ['hide_weight', 'hide_kcal'] },
  { key: 'kidney', gates: ['protein_cap'], hides: [] },
  { key: 'heart', gates: ['needs_clearance', 'beginner_only'], hides: [] },
  { key: 'diabetes', gates: ['no_fasting_deficit', 'needs_clearance', 'steady_carbs'], hides: [] },
  { key: 'bp_meds', gates: ['needs_clearance'], hides: [] },
  { key: 'injury', gates: ['beginner_only'], hides: [] },
];

const allGates = (on) => Object.fromEntries(GATES.map((g) => [g, on && !ANSWER_ONLY.has(g)]));

/** The questions to ask someone of this sex ('male' | 'female' | null).
 * Pregnancy and breastfeeding are never asked of a man. */
export function questionsFor(gender) {
  return QUESTIONS.filter((q) => !(q.notFor || []).includes(gender));
}

/** Every question for this sex answered yes or no? */
export function answeredAll(answers, gender = null) {
  return questionsFor(gender).every((q) => typeof answers?.[q.key] === 'boolean');
}

/** What the answers switch on: { gates, hides }. A question asked but left
 * without an answer counts as "yes" (skipped = gated); a question not asked
 * of this sex counts as "no". */
export function screeningResult(answers = {}, gender = null) {
  const gates = allGates(false);
  const hides = [];
  for (const q of questionsFor(gender)) {
    if (answers?.[q.key] === false) continue;
    const yes = answers?.[q.key] === true;
    for (const g of q.gates) if (yes || !ANSWER_ONLY.has(g)) gates[g] = true;
    for (const h of q.hides) if (!hides.includes(h)) hides.push(h);
  }
  return { gates, hides };
}

/** Save the check. Only flags land in the data. The hide switches are the
 * person's own: the check can turn them on, never off. */
export function applyScreening(data, answers, today, gender = data?.profile?.gender ?? null) {
  const { gates, hides } = screeningResult(answers, gender);
  const old = data.safety || {};
  const next = { ...old, screen_version: SCREEN_VERSION, screened_on: today, skipped: false, gates: { ...(old.gates || {}), ...gates } };
  if (gender === 'male') next.screened_as = 'male'; else delete next.screened_as;
  // Where an injury hurts: kept only with a "yes" to the injury question.
  const areas = answers?.injury === true ? injuryAreas(answers.injury_areas) : [];
  if (areas.length) next.injury_areas = areas; else delete next.injury_areas;
  for (const h of hides) next[h] = true;
  if (!gates.needs_clearance) delete next.clearance_seen;
  return { ...data, safety: next };
}

/** Known injury areas, in INJURY_AREAS order, no repeats. */
export function injuryAreas(list) {
  const on = new Set(Array.isArray(list) ? list : []);
  return INJURY_AREAS.filter((a) => on.has(a));
}

/** What the plan's day needs changing for: 'pregnancy' and the injury
 * areas, in the order content/safety_swaps.py lists them. */
export function swapLimits(data, today) {
  return [...(gateOn(data, 'pregnancy_safe', today) ? ['pregnancy'] : []), ...injuryAreas(data?.safety?.injury_areas)];
}

/** The day as it is safe to train: gentler sets (gentleDay), then each
 * exercise that loads a limit swapped for the first safer one not already
 * in the day, or left out when there is none. `swaps` is content's
 * training.safety_swaps.swaps. The changes are listed in
 * `safety_changes` ({ from, to | null, why }) for the screen to show. */
export function safeDay(data, day, today, swaps) {
  const gentle = gentleDay(data, day, today);
  const limits = swapLimits(data, today);
  if (!gentle || !limits.length || !swaps) return gentle;
  const tables = limits.map((why) => [why, swaps[why] || {}]);
  // Unsafe for any limit that's on: a swap must clear all of them.
  const flagged = (name) => tables.find(([, t]) => t[name]);
  const changes = [];
  const exercises = [];
  for (const e of gentle.exercises) {
    const hit = flagged(e.name);
    if (!hit) { exercises.push(e); continue; }
    const taken = new Set([...exercises, ...gentle.exercises].map((x) => x.name));
    const options = tables.flatMap(([, t]) => t[e.name] || []);
    const to = options.find((o) => !taken.has(o) && !flagged(o)) || null;
    changes.push({ from: e.name, to, why: hit[0] });
    if (to) exercises.push({ ...e, name: to, safety_swap: e.name });
  }
  return changes.length ? { ...gentle, exercises, safety_changes: changes } : gentle;
}

/** Does this exercise load a limit that is on (pregnancy, an injury
 * area)? The limit's name, or null. For swaps picked during a workout,
 * which come after safeDay (audit TRN-8). */
export function unsafeFor(data, name, today, swaps) {
  if (!swaps || !name) return null;
  for (const why of swapLimits(data, today)) if (swaps[why]?.[name]) return why;
  return null;
}

/** After the sex in Profile changes from male: the check answered as a man
 * never asked about pregnancy, so it is asked again on the next open. */
export function recheckForSex(data) {
  const s = data?.safety;
  if (s?.screened_as !== 'male' || data?.profile?.gender === 'male') return data;
  const { screened_as: _drop, ...rest } = s;
  return { ...data, safety: { ...rest, screen_version: null } };
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

/** Are weight-loss rewards (the 5 kg badge and quest) on? Only for a lose
 * goal, and never while weight is hidden or a cut is off (REW-1).
 * `direction` is the current goal's direction. */
export function rewardsWeightLoss(data, direction, today) {
  return direction === 'lose' && celebratesWeightLoss(data, today);
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
