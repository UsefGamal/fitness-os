// First-time setup for a new phone (E5-S2, E4-S7). Only a fresh install
// sees it: anyone with a profile, a workout or a weigh-in never does, so
// Yusuf's phone skips it. Five short screens (welcome, about you, goal,
// training, done); every one can be skipped. Pure helpers; setup.test.js.

import { addDays } from './dates.js';
import { saveProfile } from './macros.js';
import { startRoutine } from './routines.js';

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

/** True when the answers have everything the kcal maths needs. */
export function bodyComplete(a) {
  return Boolean(a.gender && a.birth_year && a.height_cm > 0 && a.weight_kg > 0);
}

/** Apply the answers. `a`: { gender, birth_year, height_cm, weight_kg,
 * goal, goal_kg, where, days, experience }; any may be missing (skipped).
 * Skipping the body facts hides kcal until the profile is filled in. */
export function finishSetup(data, content, a, today) {
  let d = data;
  const body = bodyComplete(a);
  const goal = GOALS.includes(a.goal) ? a.goal : 'maintain';
  if (body) {
    const dateOfGoal = goal === 'lose' || goal === 'recomp' ? setupGoalDate(a.weight_kg, a.goal_kg, today) : null;
    const hasGoal = dateOfGoal && a.goal_kg > 0;
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
  return {
    ...d,
    safety: { ...(d.safety || {}), hide_kcal: body ? Boolean(d.safety?.hide_kcal) : true },
    setup: { done_on: today, routine, needs_body: !body, skipped: false },
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
