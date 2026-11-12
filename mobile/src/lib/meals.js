// Which meal-plan day a date is, and what was eaten. Day 1 is the person's
// own start date (diet.plan_start_date: the day they finished setup, or the
// content's PLAN_START_DATE for data from before setup existed) and the
// plan cycles every 14 days.
//
// Past meals never change (DA-1): when a meal is ticked, its numbers are
// copied into the row as `eaten`, so later edits to the meal plan, or
// scaled portions, can't rewrite what someone ate last month.
import { mealLog, setMeal } from './data.js';
import { daysBetween } from './dates.js';

const MACROS = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];

/** The date the person's meal plan counts from. */
export function mealStart(data, nutrition) {
  return data?.diet?.plan_start_date || nutrition.plan_start_date;
}

export function mealDayNumber(iso, nutrition, start = nutrition.plan_start_date) {
  return daysBetween(start, iso) + 1;
}

/** The plan day for a date. `start` is mealStart(data, nutrition); left
 * out, the content's own start date. */
export function mealDayFor(iso, nutrition, start = nutrition.plan_start_date) {
  const n = mealDayNumber(iso, nutrition, start);
  const len = nutrition.days.length;
  const idx = (((n - 1) % len) + len) % len;
  return nutrition.days[idx];
}

/** The day's totals for the picked options (option A when none picked).
 * With `only` (a Set of slots), just those meals: Meals uses it for what
 * was eaten so far (E3-S12). `custom` maps a slot to what was really eaten
 * instead (UX-20). `frozen` maps a slot to the numbers copied when it was
 * ticked (eatenMeals); they win over today's content. */
export function dayTotals(day, picks = {}, only = null, custom = {}, frozen = {}) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const meal of day.meals) {
    if (only && !only.has(meal.slot)) continue;
    const opt = custom[meal.slot] || frozen[meal.slot] || meal.options.find((o) => o.key === picks[meal.slot]) || meal.options[0];
    for (const k of Object.keys(totals)) totals[k] += opt[k] || 0;
  }
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k]);
  return totals;
}

/** An option's numbers, as they are copied into a ticked meal. */
export function eatenOf(option) {
  return Object.fromEntries(MACROS.map((k) => [k, Number(option?.[k]) || 0]));
}

/** Tick or untick a plan meal. A tick copies the option's numbers into
 * the row; an untick clears them. */
export function tickMeal(data, date, slot, option, on) {
  return setMeal(data, date, slot, { completed: Boolean(on), option_key: option?.key ?? null, eaten: on && option ? eatenOf(option) : null });
}

/** Pick another option for a meal. On a meal already ticked, the copied
 * numbers follow the new pick. */
export function pickOption(data, date, slot, option) {
  const ticked = mealLog(data, date, slot)?.completed === true;
  return setMeal(data, date, slot, { option_key: option.key, ...(ticked ? { eaten: eatenOf(option) } : {}) });
}

/** slot -> the numbers copied at the tick, for dayTotals' `frozen`. */
export function eatenMeals(data, date) {
  const out = {};
  for (const m of data.meal_logs || []) {
    if (m.log_date === date && m.completed && m.eaten && !m.custom) out[m.meal_slot] = m.eaten;
  }
  return out;
}

/** Ticked meals from before DA-1 have no copied numbers: fill them in
 * once, from the plan as it stands now and the day rule that was in force
 * then (the content's start date). Returns the same object when there is
 * nothing to do, so it is safe on every start. */
export function backfillEaten(data, nutrition) {
  const rows = data?.meal_logs;
  if (!Array.isArray(rows) || !rows.some((m) => m.completed && !m.custom && !m.eaten)) return data;
  const next = rows.map((m) => {
    if (!m.completed || m.custom || m.eaten) return m;
    const meal = mealDayFor(m.log_date, nutrition).meals.find((x) => x.slot === m.meal_slot);
    if (!meal) return m;
    const option = meal.options.find((o) => o.key === m.option_key) || meal.options[0];
    return { ...m, eaten: eatenOf(option) };
  });
  return next.some((m, i) => m !== rows[i]) ? { ...data, meal_logs: next } : data;
}

const DISPLAY = { snack1: 'Morning snack', snack2: 'Afternoon snack' };

export function slotLabel(slot) {
  return DISPLAY[slot] || slot[0].toUpperCase() + slot.slice(1);
}
