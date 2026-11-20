// Home's week strip line (charts step 5, DV-04): this week's training days
// against the need, and work sets done, on the same distinct-day rule as
// the streak and the 12-week bars. Pure; weekGlance.test.js.
import { isWorkSet } from './data.js';
import { weekStart } from './dates.js';

/** { done: Set of trained dates this week, days, sets } up to today.
 * @param {import('../types').Data} data @param {string} today */
export function weekGlance(data, today) {
  const from = weekStart(today, data);
  const done = new Set();
  let sets = 0;
  for (const w of data.workouts || []) {
    if (w.log_date < from || w.log_date > today) continue;
    const work = (w.sets || []).filter(isWorkSet).length;
    if (w.finished_at || work) done.add(w.log_date);
    sets += work;
  }
  return { done, days: done.size, sets };
}
