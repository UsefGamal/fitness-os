// Dates are plain local 'YYYY-MM-DD' strings everywhere in the app, the
// same shape the server used (date.isoformat()). Never UTC: a 7:00 session
// in Cairo must land on the local day.

export function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // noon: immune to DST edges
}

export function todayISO(now = new Date()) {
  return toISO(now);
}

/** Milliseconds from `now` until just after the next local midnight (1 s
 * past, so todayISO() has surely moved on). DST-safe: built from the local
 * calendar date, not by adding 24 h. */
export function msUntilMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1000, next - now);
}

export function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((fromISO(toIso) - fromISO(fromIso)) / 86400000);
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** 'sunday' .. 'saturday' */
export function weekdayName(iso) {
  return WEEKDAYS[fromISO(iso).getDay()];
}

export function shortWeekday(iso) {
  const n = weekdayName(iso);
  return n[0].toUpperCase() + n.slice(1, 3);
}

export function longWeekday(iso) {
  const n = weekdayName(iso);
  return n[0].toUpperCase() + n.slice(1);
}

/** The Sunday on or before `iso` (the week starts on Sunday). */
export function weekStart(iso) {
  return addDays(iso, -fromISO(iso).getDay());
}

export function formatDate(iso) {
  return fromISO(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
