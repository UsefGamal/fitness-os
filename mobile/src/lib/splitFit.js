// Which split fits the days you can train, after setup too (set kinds
// round 2, 20 Nov 2026). Setup picks a routine from the days a week
// (lib/setup.js pickRoutine); this keeps that choice up to date when the
// days change on the Routines page, or once a beginner has trained for 8
// weeks. Five or more gym days for someone who has trained gets the
// combined Upper / Lower / Push / Pull / Legs week. Pure; splitFit.test.js.
import { daysBetween } from './dates.js';
import { activeBlock } from './plan.js';
import { routineById } from './routines.js';
import { DAY_CHOICES, pickRoutine } from './setup.js';

/** Trained this long, with this many sessions, counts as no longer new
 * (the same 8 weeks as the plan check-in, lib/checkIn.js). */
export const EXPERIENCED_DAYS = 56;
export const EXPERIENCED_SESSIONS = 8;

// Plans that are the same split under two ids: the Upper / Lower / Push /
// Pull / Leg plan with its notes and the plain 5-day one.
const SAME = { 'ul-ppl': 'ul-ppl-5' };
const family = (id) => SAME[id] || id;

/** Has this person trained before? Said so at setup, or 8 weeks and 8
 * finished sessions since their first one. */
export function isExperienced(data, today) {
  if (data?.setup?.experience === 'some') return true;
  const done = (data?.workouts || []).filter((w) => w.finished_at && w.log_date <= today);
  if (done.length < EXPERIENCED_SESSIONS) return false;
  const first = done.reduce((a, w) => (!a || w.log_date < a ? w.log_date : a), null);
  return daysBetween(first, today) >= EXPERIENCED_DAYS;
}

/** The routine running now, or null (an older block without a template). */
export function runningRoutine(data, content) {
  const id = activeBlock(data)?.template_id;
  return id ? routineById(content, id) : null;
}

/** Days a week the person can train: what they said (2-5, where 5 means
 * 5 or more), else the running plan's training days. */
export function daysAWeek(data, content) {
  const said = Number(data?.setup?.days);
  if (DAY_CHOICES.includes(said)) return said;
  const r = runningRoutine(data, content);
  return r ? Math.max(2, Math.min(5, r.days)) : 3;
}

/** The routine id that fits best for `days` a week. */
export function bestFit(data, content, today, days = daysAWeek(data, content)) {
  const now = runningRoutine(data, content);
  const where = now ? (now.place === 'home' ? 'home' : 'gym') : data?.setup?.where === 'home' ? 'home' : 'gym';
  return pickRoutine({ where, days, experience: isExperienced(data, today) ? 'some' : 'new' });
}

/** Is routine `id` the best fit (or the same split under another id)? */
export function isBestFit(id, best) {
  return family(id) === family(best);
}

/** A tip for the Plan page when another split fits the days better:
 * { id, name, days }, or null. Only once the person has said how many days
 * (setup or the Routines page), only for a ready-made routine, and not
 * again after "Not now" for the same days and plan. */
export function splitTip(data, content, today) {
  if (!DAY_CHOICES.includes(Number(data?.setup?.days))) return null;
  const now = runningRoutine(data, content);
  if (!now) return null;
  const days = daysAWeek(data, content);
  const best = bestFit(data, content, today, days);
  if (isBestFit(now.id, best)) return null;
  if (data.settings?.split_tip_dismissed === `${days}:${best}`) return null;
  const r = routineById(content, best);
  // "Upper / lower / push / pull / legs, 5 days" reads better without its days here.
  return r ? { id: best, name: r.name.replace(/,\s*\d+\s*days?$/i, ''), days } : null;
}

/** Save the days a week (2-5, 5 = 5 or more). */
export function setTrainingDays(data, days) {
  if (!DAY_CHOICES.includes(days)) return data;
  return { ...data, setup: { ...(data.setup || {}), days } };
}

/** "Not now" on the tip: quiet until the days or the best plan change. */
export function dismissSplitTip(data, tip) {
  return { ...data, settings: { ...(data.settings || {}), split_tip_dismissed: `${tip.days}:${tip.id}` } };
}
