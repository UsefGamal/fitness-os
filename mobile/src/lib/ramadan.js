// Ramadan mode (E12-S1), off by default. It is on only between the dates
// the person sets in Settings (diet.ramadan.from/to), never from a lunar
// calculation. While it's on:
// - meals move to suhoor, iftar and after taraweeh (the day's food and
//   totals don't change, only when and under which name);
// - the session moves to 90 min after iftar;
// - nothing reminds during fasting hours;
// - the deficit is at most 15% of TDEE, and none at all when the safety
//   gate no_fasting_deficit is on.
// Pure; tested in ramadan.test.js.
import { addDays, daysBetween } from './dates.js';
import { isTime, shiftTime, timesOf } from './times.js';

export const RAMADAN_DEFICIT_SHARE = 0.15;
/** Suggested when it's switched on; the person checks them. */
export const SUGGESTED_DATES = { from: '2027-02-08', to: '2027-03-09' };
export const DEFAULT_RAMADAN = { from: null, to: null, iftar: '17:45', suhoor: '04:15' };
/** Minutes after iftar for the session (the coach's 60-90). */
export const TRAIN_AFTER_IFTAR = 90;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function ramadanOf(data) {
  const r = data?.diet?.ramadan || {};
  return {
    from: ISO.test(r.from || '') ? r.from : null,
    to: ISO.test(r.to || '') ? r.to : null,
    iftar: isTime(r.iftar) ? r.iftar : DEFAULT_RAMADAN.iftar,
    suhoor: isTime(r.suhoor) ? r.suhoor : DEFAULT_RAMADAN.suhoor,
  };
}

/** Switched on at all (dates set), whatever today is. */
export function ramadanSet(data) {
  const r = ramadanOf(data);
  return Boolean(r.from && r.to && r.from <= r.to);
}

/** Is `iso` a Ramadan day? */
export function ramadanActive(data, iso) {
  const r = ramadanOf(data);
  return ramadanSet(data) && iso >= r.from && iso <= r.to;
}

export function setRamadan(data, changes) {
  const diet = data.diet || {};
  return { ...data, diet: { ...diet, ramadan: { ...(diet.ramadan || {}), ...changes } } };
}

/** On with the suggested dates (or the ones set before), or off. */
export function switchRamadan(data, on) {
  const now = ramadanOf(data);
  if (!on) return setRamadan(data, { from: null, to: null, ...(now.from ? { last_from: now.from, last_to: now.to } : {}) });
  const r = data.diet?.ramadan || {};
  return setRamadan(data, { from: r.last_from || SUGGESTED_DATES.from, to: r.last_to || SUGGESTED_DATES.to });
}

/** The latest a moved time can be, so it stays on its own day. */
export const LAST_TIME = '23:30';
/** After midnight, Meals stays on last night until this long before suhoor. */
export const NIGHT_BEFORE_SUHOOR = 90;
/** Days after the last fast that the water-weight note shows. */
export const AFTER_EID_DAYS = 14;

const mins = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** Fasting hours: from suhoor to iftar. */
export function isFasting(r, hhmm) {
  const t = mins(hhmm);
  return t >= mins(r.suhoor) && t < mins(r.iftar);
}

/** Which Ramadan meal each plan slot belongs to. */
export const RAMADAN_MEAL = { breakfast: 'suhoor', snack1: 'iftar', lunch: 'iftar', snack2: 'late', dinner: 'late' };

/** The times to use on `iso`: as set, or moved for Ramadan. */
export function effectiveTimes(data, content, iso) {
  const t = timesOf(data, content);
  if (!ramadanActive(data, iso)) return t;
  const r = ramadanOf(data);
  // Nothing moves past midnight: with a late summer iftar the late meals
  // and the session stay on the same day, at LAST_TIME at the latest.
  const at = (base, m) => {
    const s = shiftTime(base, m);
    return s.dayShift > 0 ? LAST_TIME : s.time;
  };
  const evening = isFasting(r, t.evening_time) ? at(r.iftar, TRAIN_AFTER_IFTAR + 120) : t.evening_time;
  return {
    ...t,
    session_time: at(r.iftar, TRAIN_AFTER_IFTAR),
    evening_time: evening,
    meal_times: { ...t.meal_times, breakfast: at(r.suhoor, -45), snack1: r.iftar, lunch: at(r.iftar, 20), snack2: at(r.iftar, 240), dinner: at(r.iftar, 255) },
    ramadan: true,
  };
}

/** The share of TDEE the deficit may take on `iso`. */
export function deficitShare(data, iso, share) {
  if (!ramadanActive(data, iso)) return share;
  if (data?.safety?.gates?.no_fasting_deficit) return 0;
  return Math.min(share, RAMADAN_DEFICIT_SHARE);
}

/** Drop any reminder that would ring in fasting hours on a Ramadan day.
 * `list` holds { at: Date }. */
export function dropFastingReminders(list, data) {
  if (!ramadanSet(data)) return list;
  const r = ramadanOf(data);
  const pad = (n) => String(n).padStart(2, '0');
  return list.filter((n) => {
    const d = new Date(n.at);
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return !(ramadanActive(data, iso) && isFasting(r, `${pad(d.getHours())}:${pad(d.getMinutes())}`));
  });
}

/** The day Meals opens on. A late meal eaten after midnight in Ramadan
 * still belongs to last night: until NIGHT_BEFORE_SUHOOR minutes before
 * suhoor, Meals opens on yesterday when yesterday was a fasting day. */
export function mealDay(data, today, hhmm) {
  const yesterday = addDays(today, -1);
  if (!ramadanActive(data, yesterday)) return today;
  const r = ramadanOf(data);
  return mins(hhmm) < mins(r.suhoor) - NIGHT_BEFORE_SUHOOR ? yesterday : today;
}

/** Days since the last fast, 1 to AFTER_EID_DAYS, else null. The note
 * about water weight after Ramadan shows on those days, unless weight
 * is hidden. */
export function afterRamadan(data, iso) {
  if (!ramadanSet(data) || data?.safety?.hide_weight === true) return null;
  const days = daysBetween(ramadanOf(data).to, iso);
  return days >= 1 && days <= AFTER_EID_DAYS ? days : null;
}

/** About how many days later the goal is reached because the deficit is
 * smaller while fasting: the Ramadan days times the share of the deficit
 * given up. `targetsOn(iso)` is macroTargets for that day (passed in, so
 * this file doesn't import the macro maths). null when it doesn't move. */
export function goalSlipDays(data, targetsOn) {
  if (!ramadanSet(data)) return null;
  const r = ramadanOf(data);
  const before = targetsOn(addDays(r.from, -1));
  const during = targetsOn(r.from);
  if (before?.mode !== 'lose' || !(before.deficit > 0)) return null;
  const given = Math.max(0, before.deficit - (during?.deficit || 0)) / before.deficit;
  const days = Math.round((daysBetween(r.from, r.to) + 1) * given);
  return days > 0 ? days : null;
}
