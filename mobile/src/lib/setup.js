// First-time setup for a new phone (E5-S2, E4-S7). Only a fresh install
// sees it: anyone with a profile, a workout or a weigh-in never does, so
// Yusuf's phone skips it. Five short screens (welcome, about you, goal,
// training, done); every one can be skipped. Pure helpers; setup.test.js.

import { addDays } from './dates.js';
import { saveProfile } from './macros.js';
import { levelFromSetup } from './levels.js';
import { startRoutine } from './routines.js';
import { setTraining } from './training.js';

export const DAY_CHOICES = [2, 3, 4, 5];
export const GOALS = ['lose', 'recomp', 'maintain', 'gain'];
// A goal date for a cut, when someone gives a goal weight: 0.5% of body
// weight a week, the slow end of the safe band.
const SETUP_PACE = 0.005;

export function needsSetup(data) {
  if (!data || data.setup) return false;
  return !data.profile && !(data.workouts || []).length && !(data.body_logs || []).length;
}

/** Which routine fits (E4-S7). `where` 'gym' | 'home', `days` 2-5+,
 * `experience` 'new' | 'some'. Beginners get full body whatever the
 * days; the ids are content/routines.py's. */
export function pickRoutine({ where = 'gym', days = 3, experience = 'new' } = {}) {
  if (where === 'home') return 'home-3';
  if (experience !== 'some') return 'starter-3';
  if (days <= 3) return 'ppl-3';
  if (days === 4) return 'upper-lower-4';
  return 'body-part-5';
}

/** The date a goal weight is reached at the setup pace, or null. */
export function setupGoalDate(weightKg, goalKg, today) {
  if (!(weightKg > 0) || !(goalKg > 0) || goalKg >= weightKg) return null;
  const weeks = (weightKg - goalKg) / (weightKg * SETUP_PACE);
  return addDays(today, Math.ceil(weeks * 7));
}

// Safe ranges for setup (QA-06). Outside them the field shows an error and
// Next stays off, so a typo (17.8 for 178 cm) never becomes a target.
export const LIMITS = { age: [16, 90], height_cm: [120, 230], weight_kg: [35, 250] };
// Under 18 the app never sets a calorie deficit: maintenance targets only.
export const ADULT_AGE = 18;

export function ageIn(birthYear, today) {
  return Number(today.slice(0, 4)) - Number(birthYear);
}

/** Field -> i18n key of what's wrong, for the fields filled in. */
export function bodyErrors(a, today) {
  const out = {};
  const inRange = (v, [lo, hi]) => Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi;
  if (a.birth_year != null && !inRange(ageIn(a.birth_year, today), LIMITS.age)) out.birth_year = 'setup.err.age';
  if (a.height_cm != null && !inRange(a.height_cm, LIMITS.height_cm)) out.height_cm = 'setup.err.height';
  if (a.weight_kg != null && !inRange(a.weight_kg, LIMITS.weight_kg)) out.weight_kg = 'setup.err.weight';
  if (a.goal_kg != null && a.weight_kg != null && !(a.goal_kg >= LIMITS.weight_kg[0] && a.goal_kg < a.weight_kg)) out.goal_kg = 'setup.err.goal';
  return out;
}

export function isMinor(a, today) {
  return a.birth_year != null && ageIn(a.birth_year, today) < ADULT_AGE;
}

/** True when the answers have everything the kcal maths needs, all in the
 * safe ranges. `today` defaults to now for callers that only check presence. */
export function bodyComplete(a, today = new Date().toISOString().slice(0, 10)) {
  const errors = bodyErrors({ ...a, goal_kg: null }, today);
  return Boolean(a.gender && a.birth_year && a.height_cm > 0 && a.weight_kg > 0) && !Object.keys(errors).length;
}

/** Apply the answers. `a`: { gender, birth_year, height_cm, weight_kg,
 * goal, goal_kg, where, days, experience }; any may be missing (skipped).
 * Skipping the body facts hides kcal until the profile is filled in. */
export function finishSetup(data, content, a, today) {
  let d = data;
  const body = bodyComplete(a, today);
  const minor = isMinor(a, today);
  // Under 18: no deficit, whatever was picked.
  const picked = GOALS.includes(a.goal) ? a.goal : 'maintain';
  const goal = minor && (picked === 'lose' || picked === 'recomp') ? 'maintain' : picked;
  if (body) {
    const dateOfGoal = goal === 'lose' || goal === 'recomp' ? setupGoalDate(a.weight_kg, a.goal_kg, today) : null;
    const hasGoal = dateOfGoal && a.goal_kg > 0 && !bodyErrors(a, today).goal_kg;
    d = saveProfile(d, {
      gender: a.gender,
      date_of_birth: `${a.birth_year}-07-01`,
      height_cm: Number(a.height_cm),
      activity_level: 'moderate',
      direction: goal,
      start_weight_kg: Number(a.weight_kg),
      goal_weight_low_kg: hasGoal ? Number(a.goal_kg) - 1 : null,
      goal_weight_high_kg: hasGoal ? Number(a.goal_kg) + 1 : null,
      goal_date: hasGoal ? dateOfGoal : null,
    }, today);
    d = { ...d, diet: { ...(d.diet || {}), plan_start_date: today } };
  } else if (a.goal) {
    d = { ...d, goals: [{ id: 'g1', set_on: today, direction: goal, start_weight_kg: null, target_low_kg: null, target_high_kg: null, target_date: null, rate_pct_bw_wk: null, ended_on: null }] };
  }
  const routine = pickRoutine(a);
  d = startRoutine(d, content, routine, today);
  d = setTraining(d, { level: levelFromSetup(a.experience) });
  return {
    ...d,
    safety: { ...(d.safety || {}), hide_kcal: body ? Boolean(d.safety?.hide_kcal) : true },
    setup: { done_on: today, routine, needs_body: !body, skipped: false, ...(minor ? { minor: true } : {}) },
  };
}

/** Skip everything: nothing set, kcal hidden, a "finish your setup" note. */
export function skipSetup(data, today) {
  return { ...data, safety: { ...(data.safety || {}), hide_kcal: true }, setup: { done_on: today, routine: null, needs_body: true, skipped: true } };
}

/** Once the profile has what the maths needs, the note goes and kcal
 * shows again (only if setup was what hid it). */
export function settleSetup(data) {
  if (!data.setup?.needs_body) return data;
  const p = data.profile || {};
  if (!(p.gender && p.date_of_birth && p.height_cm)) return data;
  return { ...data, safety: { ...(data.safety || {}), hide_kcal: false }, setup: { ...data.setup, needs_body: false } };
}
