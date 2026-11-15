// The meal library (content/meal_library.py): every meal a plan slot can be
// swapped to, like the exercise library is for training. Pure helpers:
//
// - which library meals suit a slot (by meal of day; in Ramadan the slots
//   become suhoor, iftar and the late meals);
// - applying swaps to a plan day, so totals, ticks and the shopping list
//   see the swapped meal exactly like a plan option;
// - filtering (search, tags, main protein) and grouping by protein;
// - "similar meals" by shared ingredients, protein and tags;
// - "recommended for you" from what the person picks and what is already
//   on this week's shopping list.
//
// A swap is the library meal's key in meal_logs.option_key, the field a
// plan pick already uses, so the data format doesn't change. Pure;
// mealLibrary.test.js.
import { fitOption, planDayFor, planFit } from './portions.js';
import { parseShoppingUnit } from './shopping.js';

const norm = (s) => String(s ?? '').toLowerCase();

/** The library, keyed. Cached per nutrition object. */
const index = new WeakMap();
export function libraryIndex(nutrition) {
  let hit = index.get(nutrition);
  if (!hit) {
    hit = new Map((nutrition?.library || []).map((m) => [m.key, m]));
    index.set(nutrition, hit);
  }
  return hit;
}

export function libraryMeal(key, nutrition) {
  return key ? libraryIndex(nutrition).get(key) || null : null;
}

/** The meal-of-day kinds a plan slot takes ('lunch' -> ['lunch']). */
export function kindsFor(slot, nutrition, fasting = false) {
  const map = (fasting ? nutrition?.ramadan_slot_kinds : nutrition?.slot_kinds) || {};
  return map[slot] || [slot];
}

/** Does a library meal suit a plan slot? */
export function suits(meal, slot, nutrition, fasting = false) {
  const kinds = kindsFor(slot, nutrition, fasting);
  return (meal?.meals || []).some((k) => kinds.includes(k));
}

/** Library meals for a slot, in library order. */
export function mealsForSlot(slot, nutrition, fasting = false) {
  return (nutrition?.library || []).filter((m) => suits(m, slot, nutrition, fasting));
}

/** The plan day with each slot's swap added as an option (fitted to the
 * person by `fit`, a function from option to option, e.g. FIT-1 scaling).
 * Slots without a swap, or with a key that is a plan option or unknown
 * (older picks like 'option_a'), are left as they are. Returns the same
 * day object when nothing is swapped. */
export function applySwaps(day, pickOf, nutrition, fit = (o) => o) {
  let changed = false;
  const meals = day.meals.map((meal) => {
    const key = pickOf(meal.slot);
    if (!key || meal.options.some((o) => o.key === key)) return meal;
    const lib = libraryMeal(key, nutrition);
    if (!lib) return meal;
    changed = true;
    return { ...meal, options: [...meal.options, { ...fit(lib), swapped: true }] };
  });
  return changed ? { ...day, meals } : day;
}

/** The option shown for a slot: the pick when it is there, else the plan's. */
export function shownOption(meal, pick) {
  return meal.options.find((o) => o.key === pick) || meal.options[0];
}

/** Ingredient names of a meal (the item keys without their amounts). */
export function ingredientsOf(meal) {
  return [...new Set((meal?.items || []).map((k) => parseShoppingUnit(k)[0]))];
}

/** Library meals matching a search and filters. `query` matches the name
 * and the ingredients; every tag in `tags` must be on the meal. */
export function filterMeals(list, { query = '', tags = [], protein = null, slot = null, nutrition = null, fasting = false } = {}) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const names = nutrition?.food_names || {};
  return list.filter((m) => {
    if (protein && m.protein_source !== protein) return false;
    if (tags.length && !tags.every((t) => (m.tags || []).includes(t))) return false;
    if (slot && !suits(m, slot, nutrition, fasting)) return false;
    if (!words.length) return true;
    const hay = norm([m.name, ...ingredientsOf(m).map((k) => names[k] || k)].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

/** [{ protein, meals }] in the library's protein order. */
export function byProtein(list, order = []) {
  const groups = new Map(order.map((p) => [p, []]));
  for (const m of list) {
    if (!groups.has(m.protein_source)) groups.set(m.protein_source, []);
    groups.get(m.protein_source).push(m);
  }
  return [...groups].filter(([, meals]) => meals.length).map(([protein, meals]) => ({ protein, meals }));
}

// Ingredients nearly every meal has; they say little about likeness.
const COMMON = new Set(['olive_oil', 'lemon', 'onion', 'garlic', 'tomato', 'cucumber']);

/** How alike two meals are, 0 to 1: shared distinctive ingredients
 * (Jaccard), plus the same main protein, plus shared tags. */
export function similarity(a, b) {
  if (!a || !b || a.key === b.key) return 0;
  const ia = new Set(ingredientsOf(a).filter((k) => !COMMON.has(k)));
  const ib = new Set(ingredientsOf(b).filter((k) => !COMMON.has(k)));
  const both = [...ia].filter((k) => ib.has(k)).length;
  const either = new Set([...ia, ...ib]).size || 1;
  const ta = new Set(a.tags || []);
  const tagShare = (b.tags || []).filter((t) => ta.has(t)).length / Math.max(1, Math.max(ta.size, (b.tags || []).length));
  const sameProtein = a.protein_source === b.protein_source ? 1 : 0;
  return Math.round((0.55 * (both / either) + 0.3 * sameProtein + 0.15 * tagShare) * 1000) / 1000;
}

/** The meals most like `meal`, best first: [{ meal, score }]. With
 * `slot`, only meals that suit that slot. */
export function similarMeals(meal, nutrition, { limit = 6, slot = null, fasting = false } = {}) {
  return (nutrition?.library || [])
    .filter((m) => !slot || suits(m, slot, nutrition, fasting))
    .map((m) => ({ meal: m, score: similarity(meal, m) }))
    .filter((r) => r.score >= 0.2)
    .sort((x, y) => y.score - x.score || (x.meal.name < y.meal.name ? -1 : 1))
    .slice(0, limit);
}

/** How often each library meal was picked or eaten: Map(key -> count). */
export function pickCounts(mealLogs = [], nutrition) {
  const lib = libraryIndex(nutrition);
  const counts = new Map();
  for (const m of mealLogs) {
    if (!m || !lib.has(m.option_key)) continue;
    counts.set(m.option_key, (counts.get(m.option_key) || 0) + (m.completed ? 2 : 1));
  }
  return counts;
}

/** Meals eaten or picked from `since` on (ISO date): a Set of keys, so
 * recommendations don't offer yesterday's dinner again. */
export function recentKeys(mealLogs = [], since) {
  return new Set(mealLogs.filter((m) => m && m.log_date >= since && m.option_key).map((m) => m.option_key));
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** How well a meal suits a goal, 0 to 1.
 *   lose: lots of protein for the calories (protein's share of kcal from
 *         20% up to 45%), light meals a little more;
 *   gain: more energy and carbs, hearty meals a little more;
 *   maintain / recomp: a good protein share, nothing extreme.
 * Portions are fitted to the person's calories anyway (FIT-1); this is
 * about the kind of meal. */
export function goalFit(meal, goal = 'maintain') {
  const kcal = meal?.kcal || 0;
  if (kcal <= 0) return 0;
  const proteinShare = (meal.protein * 4) / kcal;
  const carbShare = (meal.carbs * 4) / kcal;
  const tags = meal.tags || [];
  if (goal === 'lose') return clamp01(0.8 * clamp01((proteinShare - 0.2) / 0.25) + (tags.includes('light') ? 0.2 : 0) - (tags.includes('hearty') ? 0.15 : 0));
  if (goal === 'gain') return clamp01(0.5 * clamp01((kcal - 350) / 300) + 0.3 * clamp01((carbShare - 0.3) / 0.25) + (tags.includes('hearty') ? 0.2 : 0));
  // maintain, recomp: protein around a third of the energy is ideal.
  return clamp01(1 - Math.abs(proteinShare - 0.33) / 0.2);
}

/** Closeness of a meal's energy (times the person's portion factor) to
 * what the slot is meant to hold, 0 to 1 (1 within 10%). */
export function kcalFit(meal, slotKcal, factor = 1) {
  if (!(slotKcal > 0) || !(meal?.kcal > 0)) return 0.5;
  const off = Math.abs(meal.kcal * factor - slotKcal) / slotKcal;
  return clamp01(1 - Math.max(0, off - 0.1) / 0.4);
}

/** "Recommended for you" for a slot: [{ meal, score, reasons }], best
 * first. Weighs:
 *   - the person's goal (goalFit) and the slot's energy (kcalFit);
 *   - meals this person picks most, and meals like them (similarity);
 *   - ingredients already on this week's list (`weekIngredients`, a Set
 *     of ingredient names), so less to buy;
 *   - a nudge for quick meals.
 * Meals in `recent` and `exclude` (the slot's current meal) are left out. */
export function recommend(slot, nutrition, { counts = new Map(), weekIngredients = new Set(), recent = new Set(), exclude = null, fasting = false, goal = 'maintain', slotKcal = null, factor = 1, limit = 4 } = {}) {
  const lib = libraryIndex(nutrition);
  const favourites = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => [lib.get(k), n]).filter(([m]) => m);
  const top = favourites.length ? favourites[0][1] : 1;
  return mealsForSlot(slot, nutrition, fasting)
    .filter((m) => m.key !== exclude && !recent.has(m.key))
    .map((m) => {
      const reasons = [];
      const own = clamp01((counts.get(m.key) || 0) / top);
      let like = 0;
      let likeName = null;
      for (const [f, n] of favourites) {
        const v = similarity(f, m) * (n / top);
        if (v > like) { like = v; likeName = f.name; }
      }
      const ings = ingredientsOf(m).filter((k) => !COMMON.has(k));
      const onList = ings.filter((k) => weekIngredients.has(k));
      const listShare = ings.length ? onList.length / ings.length : 0;
      const fitGoal = goalFit(m, goal);
      const fitKcal = kcalFit(m, slotKcal, factor);
      if (fitGoal >= 0.7) reasons.push({ kind: 'goal', goal });
      if (own >= 0.5) reasons.push({ kind: 'often' });
      else if (like >= 0.35) reasons.push({ kind: 'like', name: likeName });
      if (onList.length) reasons.push({ kind: 'list', items: onList.slice(0, 2) });
      if ((m.tags || []).includes('quick')) reasons.push({ kind: 'quick' });
      const score = 0.3 * fitGoal + 0.1 * fitKcal + 0.2 * own + 0.2 * like + 0.15 * listShare + ((m.tags || []).includes('quick') ? 0.05 : 0);
      return { meal: m, score: Math.round(score * 1000) / 1000, reasons };
    })
    .sort((a, b) => b.score - a.score || (a.meal.name < b.meal.name ? -1 : 1))
    .slice(0, limit);
}

/** Ingredient names used by the given options (this week's meals). */
export function ingredientSet(options) {
  const out = new Set();
  for (const o of options) for (const k of ingredientsOf(o)) out.add(k);
  return out;
}

/** The list sorted best-for-goal first (ties keep library order). */
export function sortForGoal(list, goal) {
  return list.map((m, i) => ({ m, i, s: goalFit(m, goal) })).sort((a, b) => b.s - a.s || a.i - b.i).map((r) => r.m);
}

/** The plan day for a date as the person sees it: portions fitted to them
 * (FIT-1) and their swaps applied, each swap fitted the same way. Meals,
 * the shopping list and the widget all use this, so they agree. */
export function dayFor(iso, data, nutrition, today, fit = planFit(data, nutrition, today)) {
  const { day, fit: f } = planDayFor(iso, data, nutrition, today, fit);
  const logs = new Map((data.meal_logs || []).filter((m) => m && m.log_date === iso).map((m) => [m.meal_slot, m.option_key]));
  return { day: applySwaps(day, (slot) => logs.get(slot) || null, nutrition, (o) => fitOption(o, f, nutrition)), fit: f };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "?slot=lunch&date=…" on the library: the swap a visit is for, or null.
 * `params` is a URLSearchParams; an unknown slot means no swap, a missing
 * or bad date means today. */
export function swapTarget(params, today, slots) {
  const slot = params.get('slot');
  if (!slot || !slots.includes(slot)) return null;
  const date = params.get('date');
  return { slot, date: ISO_DATE.test(date || '') ? date : today };
}
