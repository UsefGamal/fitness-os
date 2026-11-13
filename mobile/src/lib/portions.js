// FIT-1: the meal plan fits each person's calorie target.
//
// The plan is written for one person (about 1,920 kcal on a normal day).
// Everyone gets ONE factor: their kcal target divided by the plan's average
// day. Inside 0.95 to 1.05 nothing changes (Yusuf, and anyone without a
// profile, see the plan exactly as written). From 0.7 to 1.4 portions are
// scaled; outside that the plan is shown unscaled with a calm line.
//
// An option is a list of food keys, one entry per unit (two eggs is
// `boiled_egg` twice), so scaling changes how many units of each food,
// in kitchen steps: halves of anything counted, half portions of weighed
// foods, whole pieces and slices. Carbs and fat move first; protein foods
// keep their units (or grow, when scaling up) and an option's protein is
// never lower than before, except under the protein_cap safety gate. No
// food is ever removed. Worked out when shown; nothing is stored.
import { mealDayFor, mealStart } from './meals.js';
import { macroTargets } from './macros.js';
import { parseShoppingUnit } from './shopping.js';

export const CLAMP = [0.7, 1.4];
export const DEAD_BAND = 0.05;
export const OPTION_TOLERANCE = 0.08;
export const DAY_TOLERANCE = 0.05;
export const PROTEIN_SHARE = 0.35;
const MACROS = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];

const optionA = (meal) => meal.options[0];

/** kcal of a day eating option A of every meal. */
export function dayKcal(day) {
  return day.meals.reduce((n, m) => n + (optionA(m)?.kcal || 0), 0);
}

/** The plan's normal day: the average of option A over the non-refeed days. */
export function planKcal(nutrition) {
  const days = nutrition.days.filter((d) => !d.is_refeed);
  const list = days.length ? days : nutrition.days;
  return Math.round(list.reduce((n, d) => n + dayKcal(d), 0) / list.length);
}

/** { factor, raw, state }: state 'same' (inside the dead band, or no
 * target), 'scaled', or 'far' (outside the clamp: rule 7). */
export function scaleFactor(target, plan) {
  const raw = target > 0 && plan > 0 ? target / plan : 1;
  if (Math.abs(raw - 1) <= DEAD_BAND + 1e-9) return { factor: 1, raw, state: 'same' };
  if (raw < CLAMP[0] || raw > CLAMP[1]) return { factor: 1, raw, state: 'far' };
  return { factor: raw, raw, state: 'scaled' };
}

// Eggs give 34% of their kcal as protein, a hair under the line, but
// nobody eats them for the carbs: they count as a protein food and are
// only ever whole.
const WHOLE_PROTEIN = new Set(['boiled_egg']);

// A side salad is mostly water and fibre: it stays one salad.
const KEEP_SIDE = new Set(['salad_tomato_cucumber']);

/** A food is a protein food when protein gives 35% or more of its kcal. */
export function isProteinFood(macros, key = '') {
  if (WHOLE_PROTEIN.has(key)) return true;
  return Boolean(macros) && macros[0] > 0 && (macros[1] * 4) / macros[0] >= PROTEIN_SHARE;
}

/** The kitchen step for a food key, in units of that key: half of
 * anything counted (half a pita, half a bowl), half a weighed portion
 * (100 g of a 200 g chicken), one tablespoon, one piece, one slice. */
export function stepOf(key) {
  if (WHOLE_PROTEIN.has(key)) return 1;
  const [, qty, unit] = parseShoppingUnit(key);
  if (unit === 'unit') return qty < 1 ? 1 : 0.5;
  if (unit === 'g') return 0.5;
  return 1 / qty; // tbsp, pc, slice: one of them
}

/** [[key, units]] in the order foods first appear. A scaled option
 * carries its own `portions`; a plan option is counted from `items`. */
export function portionsOf(option) {
  if (option?.portions) return option.portions.map((p) => [p.key, p.units]);
  const counts = new Map();
  for (const key of option?.items || []) counts.set(key, (counts.get(key) || 0) + 1);
  return [...counts];
}

const round1 = (x) => Math.round(x * 10) / 10;
const fix = (x) => Number(x.toFixed(9));

function totalsOf(parts, units) {
  const out = Object.fromEntries(MACROS.map((k) => [k, 0]));
  parts.forEach((p, i) => MACROS.forEach((k, j) => { out[k] += (p.macros?.[j] || 0) * units[i]; }));
  return out;
}

/** The candidate unit counts for one food. */
function candidates(p, factor, scaleProtein) {
  const { count, step } = p;
  const fixed = !p.macros || p.macros[0] <= 0;
  if (fixed) return [count];
  const lo = (x) => Math.max(step, fix(Math.floor(x / step) * step));
  const hi = (x) => Math.max(step, fix(Math.ceil(x / step) * step));
  let from;
  let to;
  if (KEEP_SIDE.has(p.key)) return [count];
  if (p.protein && !scaleProtein) {
    // Protein foods keep their units going down; going up they may grow.
    from = count;
    to = factor > 1 ? hi(count * factor) + step : count;
  } else if (factor < 1) {
    // Going down nothing grows.
    from = lo(count * factor * 0.4);
    to = Math.min(count, hi(count * factor) + step);
  } else {
    from = lo(count);
    to = hi(count * Math.min(factor * 1.5, 2.2)) + step;
  }
  const out = [];
  for (let i = 0; from + i * step <= to + 1e-6; i += 1) out.push(fix(from + i * step));
  return out.length ? out : [count];
}

function build(option, parts, units, sum, err, score) {
  const portions = parts.map((p, i) => ({ key: p.key, units: units[i] }));
  const changed = portions.some((p, i) => p.units !== parts[i].count);
  if (!changed) return { ...option, changed: false, fits: err <= OPTION_TOLERANCE, score };
  const out = { ...option, portions, changed: true, fits: err <= OPTION_TOLERANCE, score };
  MACROS.forEach((k) => { out[k] = k === 'kcal' ? Math.round(sum.kcal) : round1(sum[k]); });
  return out;
}

/** The best few ways to scale one option, best first (different kcal
 * each), so a day can pick the mix that lands closest. */
export function optionChoices(option, factor, foods, { proteinCap = false } = {}, keep = 6) {
  if (factor === 1 || !option?.items?.length) return [{ ...option, changed: false, fits: true, score: 0 }];
  const parts = portionsOf(option).map(([key, count]) => {
    const macros = foods[key] || null;
    return { key, count, step: stepOf(key), macros, protein: isProteinFood(macros, key) };
  });
  const goal = option.kcal * factor;
  // Going up, protein never drops; going down, only the protein foods' units are kept.
  const floor = proteinCap || factor < 1 ? -Infinity : option.protein - 1e-6;
  const lists = parts.map((p) => candidates(p, factor, proteinCap));
  // Small search: an option has at most five foods and a handful of
  // candidates each. The best fit wins; ties go to the most even scaling.
  const byKcal = new Map();
  const units = new Array(parts.length);
  const visit = (i) => {
    if (i === parts.length) {
      const sum = totalsOf(parts, units);
      if (sum.protein < floor) return;
      const err = Math.abs(sum.kcal - goal) / goal;
      const shape = parts.reduce((n, p, j) => n + Math.abs(units[j] / p.count - (p.protein && !proteinCap && factor < 1 ? 1 : factor)), 0) / parts.length;
      const score = Math.max(err, 0.02) + 0.02 * shape;
      const k = Math.round(sum.kcal);
      const had = byKcal.get(k);
      if (!had || score < had.score - 1e-9) byKcal.set(k, { score, err, units: [...units], sum });
      return;
    }
    for (const u of lists[i]) { units[i] = u; visit(i + 1); }
  };
  visit(0);
  if (!byKcal.size) return [{ ...option, changed: false, fits: false, score: 1 }];
  return [...byKcal.values()]
    .sort((a, b) => a.score - b.score)
    .slice(0, keep)
    .map((c) => build(option, parts, c.units, c.sum, c.err, c.score));
}

/** Scale one option. `proteinCap` (the protein_cap gate) lets protein
 * foods shrink. Returns the option with scaled numbers, `portions:
 * [{ key, units }]`, `changed` and `fits` (kcal within 8% of
 * option.kcal * factor). */
export function scaleOption(option, factor, foods, opts = {}) {
  const { score, ...best } = optionChoices(option, factor, foods, opts, 1)[0];
  return best;
}

const VOWEL = /^[aeiou]/i;
const SAME_PLURAL = new Set(['manakish', 'hawawshi', 'koshari', 'fattah', 'molokhia', 'shakshuka', 'fattoush', 'tabbouleh', 'mahshi']);
const plural = (word) => (SAME_PLURAL.has(word) ? word : /(s|sh|ch|x)$/.test(word) ? `${word}es` : `${word}s`);

/** "bowl of ful medames" -> "bowls of ful medames"; "boiled egg" -> "boiled eggs". */
export function pluralName(name) {
  const m = /^(.*?)(\S+)( (?:of|with) .*)$/.exec(name);
  if (m) return `${m[1]}${plural(m[2])}${m[3]}`;
  const words = name.split(' ');
  words[words.length - 1] = plural(words[words.length - 1]);
  return words.join(' ');
}

const num = (x) => String(Number(x.toFixed(2)));

/** One line of an option's food list: "1.5 wholewheat pitas", "3 boiled
 * eggs", "half a bowl of lentil soup", "white rice 225 g". */
export function portionText(key, units, names = {}) {
  const [base, qty, unit] = parseShoppingUnit(key);
  const name = names[key] || names[base] || base.replace(/_/g, ' ');
  const amount = fix(units * qty);
  if (unit === 'g') return `${name} ${num(amount)} g`;
  if (unit === 'tbsp') return `${name} ${num(amount)} tbsp`;
  if (unit === 'slice') return amount === 1 ? `a slice of ${name}` : `${num(amount)} slices of ${name}`;
  if (amount === 0.5) return `half ${VOWEL.test(name) ? 'an' : 'a'} ${name}`;
  if (amount === 1) return `${VOWEL.test(name) ? 'an' : 'a'} ${name}`;
  return `${num(amount)} ${pluralName(name)}`;
}

const withText = (o, names) => {
  const { score, ...rest } = o;
  return rest.changed ? { ...rest, ingredients: rest.portions.map((p) => portionText(p.key, p.units, names)) } : rest;
};

/** Scale every option of a day. Option B of each meal takes its own best
 * fit; option A's are picked together so the day (eating option A all
 * day) lands within 5% of its kcal times the factor. `fits` is false when
 * no mix gets there (rule 7). */
export function scaleDay(day, factor, nutrition, opts = {}) {
  if (factor === 1) return { day, fits: true };
  const names = nutrition.food_names || {};
  const goal = dayKcal(day) * factor;
  const choices = day.meals.map((m) => (m.options[0] ? optionChoices(m.options[0], factor, nutrition.foods, opts) : [null]));
  const best = { total: Infinity, err: Infinity, pick: /** @type {any[]} */ ([]) };
  const pick = new Array(choices.length);
  const visit = (i, kcal, score) => {
    if (i === choices.length) {
      const err = Math.abs(kcal - goal) / goal;
      const total = err <= DAY_TOLERANCE ? score : 100 + err;
      if (total < best.total - 1e-9) Object.assign(best, { total, err, pick: [...pick] });
      return;
    }
    for (const c of choices[i]) { pick[i] = c; visit(i + 1, kcal + (c?.kcal || 0), score + (c?.score || 0)); }
  };
  visit(0, 0, 0);
  const meals = day.meals.map((meal, i) => ({
    ...meal,
    options: meal.options.map((o, j) => withText(j === 0 ? best.pick[i] : optionChoices(o, factor, nutrition.foods, opts, 1)[0], names)),
  }));
  return { day: { ...day, meals }, fits: best.err <= DAY_TOLERANCE };
}

/** How the plan fits this person: { state, factor, plan, cap }. */
export function planFit(data, nutrition, today) {
  const plan = planKcal(nutrition);
  const target = macroTargets(data, nutrition, today);
  if (target.source === 'plan') return { state: 'same', factor: 1, plan, cap: false };
  const f = scaleFactor(target.kcal, plan);
  return { ...f, plan, cap: Boolean(target.gated?.includes('protein_cap')) };
}

const cache = new Map();

/** The meal day for a date, fitted to the person: { day, fit }. When the
 * plan already fits (state 'same') `day` is the content's own object, so
 * nothing about it changes. A scaled day that misses the 5% window is
 * shown unscaled with state 'far' (rule 7). */
export function planDayFor(iso, data, nutrition, today, fit = planFit(data, nutrition, today)) {
  const day = mealDayFor(iso, nutrition, mealStart(data, nutrition));
  if (fit.state !== 'scaled') return { day, fit };
  const key = `${day.day_index}|${fit.factor}|${fit.cap}`;
  let hit = cache.get(key);
  if (!hit || hit.nutrition !== nutrition) {
    hit = { nutrition, ...scaleDay(day, fit.factor, nutrition, { proteinCap: fit.cap }) };
    if (cache.size > 64) cache.clear();
    cache.set(key, hit);
  }
  return hit.fits ? { day: hit.day, fit } : { day, fit: { ...fit, state: 'far' } };
}
