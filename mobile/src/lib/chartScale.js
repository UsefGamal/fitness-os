// Chart scales (CHART-1). Points sit at their real date, so a 10-day gap
// between weigh-ins draws ten times as wide as a 1-day gap and the slope
// on screen matches the real rate. Pure, tested in chartScale.test.js.
import { daysBetween } from './dates.js';

/** A function from an ISO date to x between `x0` and `x1`, spanning the
 * first to the last of `dates` (oldest first). One date, or every date
 * the same, sits in the middle.
 * @param {string[]} dates @param {number} x0 @param {number} x1 */
export function dateScale(dates, x0, x1) {
  const first = dates[0];
  const span = dates.length ? daysBetween(first, dates[dates.length - 1]) : 0;
  if (!span) return () => (x0 + x1) / 2;
  return (date) => x0 + (daysBetween(first, date) / span) * (x1 - x0);
}
