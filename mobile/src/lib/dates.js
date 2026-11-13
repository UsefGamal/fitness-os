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
  return Math.max(1000, next.getTime() - now.getTime());
}

export function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((fromISO(toIso).getTime() - fromISO(fromIso).getTime()) / 86400000);
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

/** Does this person's week start on Monday? (Settings, WEEK-1; Sunday
 * by default.) `data` may be left out, or be 'mon' / 'sun'. */
export function startsMonday(data) {
  return data === 'mon' || data?.profile?.week_start === 'mon';
}

/** The first day of the week holding `iso`: the Sunday on or before it,
 * or the Monday when the person's week starts on Monday. */
export function weekStart(iso, data) {
  const dow = fromISO(iso).getDay();
  return addDays(iso, -(startsMonday(data) ? (dow + 6) % 7 : dow));
}

/** The language dates and numbers are written in: the app's, not the
 * phone's, so a phone set to Arabic doesn't show Arabic dates and digits
 * above English text. One constant, for the day the app speaks Arabic. */
export const LOCALE = 'en-GB';

export function formatDate(iso, locale = LOCALE) {
  return fromISO(iso).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "12 Nov 2026". */
export function longDate(iso, locale = LOCALE) {
  return fromISO(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "November 2026" for a "YYYY-MM" key. */
export function monthLabel(key, locale = LOCALE) {
  return new Date(`${key}-15T12:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/** "Thu 12 Nov, 08:14" for a time in ms. */
export function dateTime(at, locale = LOCALE) {
  return new Date(at).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** 12345 as "12,345". */
export function formatNumber(n, locale = LOCALE) {
  return Number(n).toLocaleString(locale);
}
