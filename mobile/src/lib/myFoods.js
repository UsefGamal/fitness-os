// "I ate something else" (UX-20): a meal slot can hold what was really
// eaten instead of the plan's option, and named foods are remembered so
// the next time is one tap. Both are additive keys (`custom` on a meal log
// row, `my_foods` on the data), so older backups and older builds still
// read the data; no schema bump.
import { setMeal } from './data.js';

export const MAX_FOOD_NAME = 40;
export const MAX_KCAL = 3000;
export const MAX_PROTEIN = 300;
export const MAX_MY_FOODS = 30;

/** A safe food from form input, or null when the numbers make no sense. */
export function cleanFood(input) {
  const kcal = Math.round(Number(input?.kcal));
  const protein = Math.round(Number(input?.protein));
  if (!Number.isFinite(kcal) || !Number.isFinite(protein)) return null;
  if (kcal < 0 || kcal > MAX_KCAL || protein < 0 || protein > MAX_PROTEIN) return null;
  // Protein alone is 4 kcal a gram: more protein than the calories allow is a typo.
  if (protein * 4 > kcal + 20) return null;
  const name = String(input?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_FOOD_NAME);
  return { name, kcal, protein };
}

/** The foods this person saved, newest first. */
export function myFoods(data) {
  return Array.isArray(data.my_foods) ? data.my_foods : [];
}

/** Remember a named food, newest first, one entry per name. */
export function rememberFood(data, food) {
  const clean = cleanFood(food);
  if (!clean || !clean.name) return data;
  const same = (f) => f.name.toLowerCase() === clean.name.toLowerCase();
  return { ...data, my_foods: [clean, ...myFoods(data).filter((f) => !same(f))].slice(0, MAX_MY_FOODS) };
}

export function forgetFood(data, name) {
  return { ...data, my_foods: myFoods(data).filter((f) => f.name.toLowerCase() !== String(name).toLowerCase()) };
}

/** Log something else for a slot: it counts as eaten, and a named food is remembered. */
export function logCustomMeal(data, date, slot, food) {
  const clean = cleanFood(food);
  if (!clean) return data;
  return rememberFood(setMeal(data, date, slot, { completed: true, custom: clean }), clean);
}

/** Back to the plan's meal for this slot, not eaten. */
export function clearCustomMeal(data, date, slot) {
  return setMeal(data, date, slot, { completed: false, custom: null });
}

/** slot -> what was really eaten, for dayTotals. */
export function customMeals(data, date) {
  const out = {};
  for (const m of data.meal_logs || []) {
    if (m.log_date === date && m.custom) out[m.meal_slot] = m.custom;
  }
  return out;
}
