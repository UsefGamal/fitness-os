// When things happen, adjustable in Settings → Times and reminders: the
// morning session, the evening (8 PM) slot, each meal, and how early the
// reminders come. Stored in data.settings.times; pure helpers, tested in
// times.test.js.

export const REMIND_CHOICES = [0, 10, 15, 30, 45, 60, 90];

export function defaultTimes(content) {
  const N = content.nutrition;
  return {
    session_time: content.training.session_time, // the trainer plan's 07:00
    evening_time: '20:00',
    remind_before: 30, // minutes before a session
    remind_workouts: true,
    remind_evening: true,
    // Meals are opt-in (P14-12): by default at most 2 reminders a day.
    remind_meals: false,
    meal_times: Object.fromEntries(N.meal_slots.map((s) => [s, N.meal_slot_windows[s].split('–')[0].padStart(5, '0')])),
  };
}

/** The times with defaults filled in (and bad values dropped). */
export function timesOf(data, content) {
  const d = defaultTimes(content);
  const t = data?.settings?.times || {};
  const ok = (v, fallback) => (isTime(v) ? v : fallback);
  return {
    ...d,
    ...t,
    session_time: ok(t.session_time, d.session_time),
    evening_time: ok(t.evening_time, d.evening_time),
    remind_before: REMIND_CHOICES.includes(t.remind_before) ? t.remind_before : d.remind_before,
    // "It varies" (WEEK-1): no set time, so no timed session reminder.
    session_varies: t.session_varies === true,
    meal_times: Object.fromEntries(Object.entries(d.meal_times).map(([s, v]) => [s, ok(t.meal_times?.[s], v)])),
  };
}

/** The session time to show, or null when it varies. */
export function sessionAt(times) {
  return times?.session_varies ? null : times?.session_time ?? null;
}

export function setTimes(data, changes) {
  const t = data.settings?.times || {};
  const next = { ...t, ...changes, ...(changes.meal_times ? { meal_times: { ...(t.meal_times || {}), ...changes.meal_times } } : {}) };
  return { ...data, settings: { ...data.settings, times: next } };
}

export function isTime(v) {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** 'HH:MM' moved by `minutes` (wraps around midnight): { time, dayShift }. */
export function shiftTime(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const raw = h * 60 + m + minutes;
  const dayShift = Math.floor(raw / 1440);
  const t = ((raw % 1440) + 1440) % 1440;
  return { time: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, dayShift };
}

/** "on time" or "30 min before". */
export function leadText(minutes) {
  return minutes ? `${minutes} min before` : 'on time';
}
