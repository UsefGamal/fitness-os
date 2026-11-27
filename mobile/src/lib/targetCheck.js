// The weekly target check (TARGET-1: COACH-8, BIZ-8, DA-3). After three
// weeks where the weight trend held flat while most meals were ticked, Home
// offers to adjust the calories down by 100-150 kcal a day. The person
// confirms; nothing changes by itself. At most once every three weeks, and
// never with a safety limit on, calories hidden, under 18 or in Ramadan
// (psychology review). The words say "adjust", never "stalled". Pure;
// targetCheck.test.js.
import { addDays, daysBetween } from './dates.js';
import { trendSeries } from './progress.js';
import { ramadanActive } from './ramadan.js';
import { gatesOn, isMinorNow, kcalHidden } from './safety.js';

export const WINDOW_DAYS = 21;
export const FLAT_KG = 0.3; // the trend moved less than this in 3 weeks
export const MIN_WEIGH_INS = 6;
export const MEALS_SHARE = 0.8;
export const STEP_SMALL = 100;
export const STEP_BIG = 150;
export const BIG_FROM_TDEE = 2500;

const openGoal = (data) => {
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  for (let i = goals.length - 1; i >= 0; i -= 1) if (!goals[i].ended_on) return goals[i];
  return null;
};

/** The current goal's adjustments, newest last: [{ on, kcal }]. */
export function adjustments(data) {
  const list = openGoal(data)?.kcal_adjust;
  return Array.isArray(list) ? list.filter((a) => a && Number.isFinite(a.kcal) && typeof a.on === 'string') : [];
}

/** The sum of the adjustments, in kcal a day (negative is less). */
export function adjustTotal(data) {
  return adjustments(data).reduce((s, a) => s + a.kcal, 0);
}

/** Did the trend hold within FLAT_KG over the last three weeks, with
 * enough weigh-ins to say so? */
export function trendFlat(logs, today) {
  const from = addDays(today, -WINDOW_DAYS);
  const series = trendSeries(logs || []).filter((p) => p.date >= from && p.date <= today);
  if (series.length < MIN_WEIGH_INS || daysBetween(series[0].date, series[series.length - 1].date) < 14) return false;
  const ys = series.map((p) => p.trend);
  return Math.max(...ys) - Math.min(...ys) < FLAT_KG;
}

/** The share of meals ticked over the last three weeks (0-1). */
export function mealsShare(data, slots, today) {
  const from = addDays(today, -WINDOW_DAYS + 1);
  const ticked = (data.meal_logs || []).filter((m) => m.completed && m.log_date >= from && m.log_date <= today && slots.includes(m.meal_slot)).length;
  return slots.length ? ticked / (slots.length * WINDOW_DAYS) : 0;
}

/** 150 kcal for a bigger TDEE, else 100. */
export function stepFor(tdeeKcal) {
  return tdeeKcal >= BIG_FROM_TDEE ? STEP_BIG : STEP_SMALL;
}

/** Is the check due today? `targets` is macroTargets(...) for today;
 * `slots` the plan's meal slots; `minKcal` the floor for this person.
 * @returns {{ step: number } | null} */
export function targetCheckDue(data, { targets, slots, minKcal, today }) {
  const dir = openGoal(data)?.direction || 'lose';
  if (dir !== 'lose' && dir !== 'recomp') return null;
  if (!targets || targets.source === 'plan' || targets.mode !== dir) return null;
  if (kcalHidden(data) || isMinorNow(data, today) || ramadanActive(data, today) || gatesOn(data, today).length) return null;
  const g = openGoal(data);
  if (!g) return null;
  // At most once every three weeks: since the goal started, the last
  // adjustment, and the last "Keep as is".
  const last = [g.set_on, ...adjustments(data).map((a) => a.on), g.kcal_check_kept_on].filter(Boolean).sort().pop();
  if (last && daysBetween(last, today) < WINDOW_DAYS) return null;
  if (!trendFlat(data.body_logs, today)) return null;
  if (mealsShare(data, slots, today) < MEALS_SHARE) return null;
  // Already at the safe deficit (the 25% cap): a cut would do nothing.
  if ((targets.reasons || []).includes('capped')) return null;
  const step = stepFor(targets.tdee);
  if (targets.kcal - step < minKcal) return null;
  return { step };
}

const withGoal = (data, fn) => {
  const g = openGoal(data);
  if (!g) return data;
  return { ...data, goals: data.goals.map((x) => (x === g ? fn(x) : x)) };
};

/** "Lower by N kcal": one more adjustment on the current goal. */
export function lowerTarget(data, step, today) {
  return withGoal(data, (g) => ({ ...g, kcal_adjust: [...adjustments(data), { on: today, kcal: -Math.abs(step) }] }));
}

/** "Keep as is": not asked again for three weeks. */
export function keepTarget(data, today) {
  return withGoal(data, (g) => ({ ...g, kcal_check_kept_on: today }));
}

/** Undo every adjustment on the current goal (Meals, "Undo"). */
export function clearAdjustments(data) {
  return withGoal(data, (g) => {
    const { kcal_adjust: _drop, ...rest } = g;
    return rest;
  });
}
