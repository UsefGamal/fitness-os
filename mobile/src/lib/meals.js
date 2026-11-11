// Which meal-plan day a date is. Mirrors routers/meals.py: day 1 is
// PLAN_START_DATE and the static plan cycles every 14 days.
import { daysBetween } from './dates.js';

export function mealDayNumber(iso, nutrition) {
  return daysBetween(nutrition.plan_start_date, iso) + 1;
}

export function mealDayFor(iso, nutrition) {
  const n = mealDayNumber(iso, nutrition);
  const len = nutrition.days.length;
  const idx = (((n - 1) % len) + len) % len;
  return nutrition.days[idx];
}

/** The day's totals for the picked options (option A when none picked).
 * With `only` (a Set of slots), just those meals: Meals uses it for what
 * was eaten so far (E3-S12). `custom` maps a slot to what was really eaten
 * instead (UX-20); only its kcal and protein are known. */
export function dayTotals(day, picks = {}, only = null, custom = {}) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const meal of day.meals) {
    if (only && !only.has(meal.slot)) continue;
    const opt = custom[meal.slot] || meal.options.find((o) => o.key === picks[meal.slot]) || meal.options[0];
    for (const k of Object.keys(totals)) totals[k] += opt[k] || 0;
  }
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k]);
  return totals;
}

const DISPLAY = { snack1: 'Morning snack', snack2: 'Afternoon snack' };

export function slotLabel(slot) {
  return DISPLAY[slot] || slot[0].toUpperCase() + slot.slice(1);
}
