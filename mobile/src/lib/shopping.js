// The week's shopping list from the static meal plan. Mirrors
// routers/meals.py's shopping_list_page and content/food_items.py's
// parse_shopping_unit / format_shopping_qty: seven days from today,
// quantities merged across portion sizes ("chicken 200g" + "chicken 150g").
// With `pickOf` the list holds only the option picked for each meal (the
// first one when nothing is picked), so it buys what will be eaten (UX-18).
// Without it, both options of every meal, as the old web app did.
import { addDays } from './dates.js';
import { mealDayFor } from './meals.js';

const UNIT_RE = /^(.+)_(\d+(?:\.\d+)?)(g|tbsp|pc|slices?)$/;
const FALLBACK_CATEGORY = 'Nuts, Sauces & Extras';

export function parseShoppingUnit(key) {
  const m = UNIT_RE.exec(key);
  if (m) return [m[1], Number(m[2]), m[3].startsWith('slice') ? 'slice' : m[3]];
  if (key.endsWith('_half')) return [key.slice(0, -'_half'.length), 0.5, 'unit'];
  return [key, 1, 'unit'];
}

// Python's f"{x:g}": no trailing zeros.
const g = (x) => String(Number(x.toPrecision(6)));

export function formatShoppingQty(total, unit) {
  if (unit === 'g') return total >= 1000 ? `${g(total / 1000)} kg` : `${g(total)} g`;
  if (unit === 'tbsp' || unit === 'pc') return `${g(total)} ${unit}`;
  if (unit === 'slice') return total === 1 ? '1 slice' : `${g(total)} slices`;
  return `×${g(total)}`;
}

/** A food's name for the list, in sentence case (P14-19): the content's
 * own name when it has one ("Low-fat Greek yogurt"), else the key in words. */
export function displayName(key, names = {}) {
  const s = names[key] || key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The option key picked for each (date, slot), from the meal log. */
export function picksFrom(mealLogs = []) {
  const map = new Map(mealLogs.filter((m) => m.option_key).map((m) => [`${m.log_date}|${m.meal_slot}`, m.option_key]));
  return (date, slot) => map.get(`${date}|${slot}`) || null;
}

/** [{ name, items: [{ key, name, qty }] }] in the plan's category order.
 * `pickOf(date, slot)` -> option key or null; leave it out for both options. */
export function shoppingList(startIso, nutrition, days = 7, pickOf = null, planStart = nutrition.plan_start_date) {
  const totals = new Map();
  const category = new Map();
  for (let i = 0; i < days; i += 1) {
    const date = addDays(startIso, i);
    const day = mealDayFor(date, nutrition, planStart);
    for (const meal of day.meals) {
      const chosen = pickOf ? [meal.options.find((o) => o.key === pickOf(date, meal.slot)) || meal.options[0]].filter(Boolean) : meal.options;
      for (const option of chosen) {
        for (const item of option.items) {
          const [base, qty, unit] = parseShoppingUnit(item);
          const k = `${base}|${unit}`;
          totals.set(k, (totals.get(k) || 0) + qty);
          if (!category.has(base)) category.set(base, nutrition.food_categories[item] || FALLBACK_CATEGORY);
        }
      }
    }
  }
  const groups = new Map(nutrition.category_order.map((c) => [c, []]));
  for (const [k, total] of totals) {
    const [base, unit] = k.split('|');
    const cat = category.get(base) || FALLBACK_CATEGORY;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push({ key: k, name: displayName(base, nutrition.food_names), qty: formatShoppingQty(total, unit) });
  }
  return [...groups]
    .filter(([, items]) => items.length)
    .map(([name, items]) => ({ name, items: items.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) }));
}
