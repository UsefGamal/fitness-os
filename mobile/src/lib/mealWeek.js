// Meals: the last 7 days at a glance (charts step 5, DV-13 + BI-11). Ticked
// meals copy the plan's numbers, so a calorie dot would be "on target" by
// construction: instead one row says how much of each day was logged, and
// one says whether protein reached 90% of the target on the logged days.
// Unlogged days are left out of the protein count. Pure; mealWeek.test.js.
import { addDays } from './dates.js';
import { gateOn, kcalHidden } from './safety.js';

export const PROTEIN_HIT = 0.9;

/**
 * { days: [{ date, logged: 'full'|'part'|'none', protein, hit }], full,
 *   proteinDays, proteinHit, showProtein } for the 7 days to `today`,
 * oldest first. hit is null on a day with nothing logged.
 * @param {import('../types').Data} data @param {string[]} slots
 * @param {string} today @param {number} proteinTarget */
export function mealWeek(data, slots, today, proteinTarget) {
  const from = addDays(today, -6);
  const by = new Map();
  for (const m of data.meal_logs || []) {
    if (!m.completed || m.log_date < from || m.log_date > today || !slots.includes(m.meal_slot)) continue;
    if (!by.has(m.log_date)) by.set(m.log_date, { slots: new Set(), protein: 0 });
    const d = by.get(m.log_date);
    d.slots.add(m.meal_slot);
    d.protein += Number(m.eaten?.protein) || 0;
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(from, i);
    const d = by.get(date);
    const n = d ? d.slots.size : 0;
    const logged = !n ? 'none' : n >= slots.length ? 'full' : 'part';
    const protein = d ? Math.round(d.protein) : 0;
    return { date, logged, protein, hit: n && proteinTarget > 0 ? protein >= proteinTarget * PROTEIN_HIT : null };
  });
  const counted = days.filter((d) => d.hit != null);
  return {
    days,
    full: days.filter((d) => d.logged === 'full').length,
    proteinDays: counted.length,
    proteinHit: counted.filter((d) => d.hit).length,
    showProtein: !kcalHidden(data) && !gateOn(data, 'protein_cap', today) && proteinTarget > 0,
  };
}
