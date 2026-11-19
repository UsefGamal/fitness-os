// The story-style first-time setup (ONB-2, 19 Nov 2026): one question per
// screen, a segmented bar on top, Back on every screen but the first. This
// file decides which screens a person sees, in order, from the answers so
// far, plus the small sums the pickers and the goal chart need. Pure;
// setupSteps.test.js.

import { questionsFor, screeningResult } from './safety.js';
import { LIMITS, ageIn, isMinor, setupGoalDate } from './setup.js';

/** Screen ids in order. Some depend on earlier answers:
 *  - one safety screen per question for this sex (no pregnancy question
 *    for a man), all gone when the check is skipped,
 *  - goal weight only for a cut (lose, recomp) when a weight was given,
 *  - the goal chart only when that gives a date,
 *    and not while the safety check holds calories at maintenance. */
export function setupSteps(a = {}, today) {
  const steps = ['welcome', 'name', 'sex', 'age', 'height', 'weight'];
  if (a.screening !== null) for (const q of questionsFor(a.gender ?? null)) steps.push(`safety:${q.key}`);
  steps.push('goal');
  const cut = (a.goal === 'lose' || a.goal === 'recomp') && !(today && isMinor(a, today));
  if (cut && a.weight_kg > 0) {
    steps.push('goal_weight');
    // No chart while the check holds calories at maintenance: there is no
    // cut to draw (skipped counts as held).
    const held = a.screening === null || (a.screening && screeningResult(a.screening, a.gender ?? null).gates.no_deficit);
    if (!held && today && setupGoalDate(a.weight_kg, a.goal_kg, today)) steps.push('projection');
  }
  steps.push('where', 'experience', 'days', 'job', 'time', 'done');
  return steps;
}

/** Where to go after `id`, in the steps for these answers. */
export function nextStep(steps, id) {
  const i = steps.indexOf(id);
  return i < 0 ? steps[0] : steps[Math.min(steps.length - 1, i + 1)];
}

/** Where Back goes from `id`. */
export function prevStep(steps, id) {
  const i = steps.indexOf(id);
  return i <= 0 ? steps[0] : steps[i - 1];
}

/** The first screen after the safety questions (for "Skip the check"). */
export function afterSafety(steps) {
  return steps.find((s, i) => i > 0 && !s.startsWith('safety:') && steps[i - 1].startsWith('safety:')) || 'goal';
}

/** How far along, for the bar: the welcome screen doesn't count. */
export function progressOf(steps, id) {
  const shown = steps.filter((s) => s !== 'welcome');
  return { at: Math.max(0, shown.indexOf(id)), of: shown.length };
}

/** A value snapped to the picker's step and range. */
export function snap(value, { min, max, step }) {
  const n = Math.round((Number(value) - min) / step) * step + min;
  const clamped = Math.min(max, Math.max(min, n));
  return Number(clamped.toFixed(step < 1 ? 1 : 0));
}

/** The ages the age wheel offers, from the setup limits. */
export function ageChoices() {
  const out = [];
  for (let n = LIMITS.age[0]; n <= LIMITS.age[1]; n += 1) out.push(n);
  return out;
}

/** Age <-> birth year (setup stores the year, as before). */
export const birthYearFor = (age, today) => Number(today.slice(0, 4)) - age;
export const ageFor = (birthYear, today) => (birthYear ? ageIn(birthYear, today) : null);

/** Starting points for the pickers when nothing is picked yet. */
export function pickerStart(a = {}) {
  const female = a.gender === 'female';
  return {
    age: 30,
    height_cm: female ? 163 : 176,
    weight_kg: female ? 65 : 80,
  };
}

/** A sensible first goal weight: 8% under the weight now, in half kilos,
 * never under the floor. */
export function goalStart(weightKg) {
  const g = Math.round(weightKg * 0.92 * 2) / 2;
  return Math.max(LIMITS.weight_kg[0], Math.min(g, weightKg - 0.5));
}

/** The change a goal weight means, for the note under the picker. */
export function goalChange(weightKg, goalKg) {
  if (!(weightKg > 0) || !(goalKg > 0)) return null;
  const kg = Math.round((weightKg - goalKg) * 10) / 10;
  return { kg, pct: Math.round((kg / weightKg) * 100) };
}

/** Points for the goal chart: weight now to the goal, eased like a steady
 * cut (faster at first, slower near the end). `n` points from 0 to 1 on x. */
export function projectionPoints(weightKg, goalKg, n = 24) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const x = i / n;
    const eased = 1 - (1 - x) ** 1.6;
    out.push({ x, kg: weightKg + (goalKg - weightKg) * eased });
  }
  return out;
}
