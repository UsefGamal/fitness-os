// Measured maintenance (charts step 5, BI-13): what the person's own month
// says they burn, from the calories logged and how the weight moved.
//   burn ≈ mean kcal on fully logged days − 7700 × (kg change a day)
// The kg change is the Theil-Sen pace (lib/pace.js), so the range comes
// from its middle half. Ticked meals copy the plan's numbers, so this is
// planned intake: an estimate, shown as a range rounded to 50 kcal, never
// a single exact number. Pure, tested in measuredBurn.test.js.
import { addDays } from './dates.js';
import { currentGoal } from './macros.js';
import { paceRange } from './pace.js';
import { ramadanActive } from './ramadan.js';
import { gatesOn, isMinorNow, kcalHidden } from './safety.js';

export const BURN_DAYS = 28;
export const BURN_MIN_DAYS = 21;
export const BURN_SHARE = 0.8;
export const KCAL_PER_KG = 7700;

const r50 = (n) => Math.round(n / 50) * 50;

/**
 * { ready: true, low, high, mid, eaten, days, model, diff } or
 * { ready: false, reason, need? } where reason is 'hidden' (calories hidden,
 * under 18, a safety limit or Ramadan: nothing is shown), 'water' (the
 * goal's first 2 weeks), 'weigh' (needs `need` more weigh-ins), 'meals'
 * (under 80% of meals logged) or 'days' (needs `need` more fully logged
 * days, of 21).
 * diff = model − measured mid: positive means the model guesses high.
 * @param {import('../types').Data} data @param {string[]} slots
 * @param {string} today @param {number | null} [modelTdee] */
export function measuredBurn(data, slots, today, modelTdee = null) {
  if (kcalHidden(data) || isMinorNow(data, today) || ramadanActive(data, today) || gatesOn(data, today).length) return { ready: false, reason: 'hidden' };
  const goal = currentGoal(data);
  const pace = paceRange(data.body_logs || [], goal, today);
  if (!pace.ready) return pace.reason === 'water' ? { ready: false, reason: 'water' } : { ready: false, reason: 'weigh', need: pace.need };
  const from = addDays(today, -(BURN_DAYS - 1));
  const byDay = new Map();
  let ticked = 0;
  for (const m of data.meal_logs || []) {
    if (!m.completed || m.log_date < from || m.log_date > today || !slots.includes(m.meal_slot)) continue;
    ticked += 1;
    if (!byDay.has(m.log_date)) byDay.set(m.log_date, { slots: new Set(), kcal: 0 });
    const d = byDay.get(m.log_date);
    d.slots.add(m.meal_slot);
    d.kcal += Number(m.eaten?.kcal) || 0;
  }
  if (!slots.length || ticked / (slots.length * BURN_DAYS) < BURN_SHARE) return { ready: false, reason: 'meals' };
  const full = [...byDay.values()].filter((d) => d.slots.size === slots.length && d.kcal > 0);
  if (full.length < BURN_MIN_DAYS) return { ready: false, reason: 'days', need: BURN_MIN_DAYS - full.length };
  const eaten = full.reduce((a, d) => a + d.kcal, 0) / full.length;
  // pace is towards the goal; turn it into the actual change a week.
  const toward = goal?.direction === 'gain' ? 1 : -1;
  const burnAt = (kgWeek) => eaten - (KCAL_PER_KG * toward * kgWeek) / 7;
  const a = burnAt(pace.low);
  const b = burnAt(pace.high);
  const mid = r50(burnAt(pace.mid));
  return {
    ready: true,
    low: r50(Math.min(a, b)),
    high: r50(Math.max(a, b)),
    mid,
    eaten: r50(eaten),
    days: full.length,
    model: modelTdee ? r50(modelTdee) : null,
    diff: modelTdee ? r50(modelTdee) - mid : null,
  };
}
