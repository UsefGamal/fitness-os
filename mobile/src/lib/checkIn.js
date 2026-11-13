// Plan check-in (8 weeks on one plan). After CHECKIN_WEEKS on the same
// plan, with enough sessions done, Plan offers a short guided check-in:
// first a better plan when one fits now (lib/setup.js pickRoutine, with the
// person counted as no longer new), then one exercise at a time to keep or
// swap. "Later" asks again in two weeks; finishing marks this plan done, so
// the next check-in comes 8 weeks into the next plan. Pure; checkIn.test.js.
import { addDays, daysBetween } from './dates.js';
import { activeBlock, activePlan } from './plan.js';
import { effectiveDay } from './planEdit.js';
import { routineById } from './routines.js';
import { pickRoutine } from './setup.js';

export const CHECKIN_WEEKS = 8;
/** Sessions on the plan before the check-in is worth it (1 a week). */
export const CHECKIN_SESSIONS = 8;
export const SNOOZE_DAYS = 14;

/** Is the check-in due today? */
export function checkInDue(data, today) {
  const block = activeBlock(data);
  if (!block?.started_on || !block.template_id) return false;
  const s = data?.settings || {};
  if (s.checkin_done === block.id) return false;
  if (s.checkin_snooze && s.checkin_snooze > today) return false;
  if (daysBetween(block.started_on, today) < CHECKIN_WEEKS * 7) return false;
  const done = (data.workouts || []).filter((w) => w.block_id === block.id && w.finished_at).length;
  return done >= CHECKIN_SESSIONS;
}

/** A better ready-made plan for now, or null. Only for people on a
 * ready-made routine (never the build's own plan), and only toward a plan
 * for someone who has trained before: 8 weeks in, they have. */
export function betterRoutine(data, content) {
  const block = activeBlock(data);
  const now = block ? routineById(content, block.template_id) : null;
  if (!now || now.own) return null;
  const days = Number(data?.setup?.days) || now.days;
  const id = pickRoutine({ where: now.place === 'home' ? 'home' : 'gym', days, experience: 'some' });
  return id !== now.id && routineById(content, id) ? id : null;
}

/** Every exercise of the running plan, in week order: { key, label, index, name }. */
export function checkInExercises(data, content) {
  const T = activePlan(data, content);
  const seen = new Set();
  const out = [];
  for (const d of T.trainer_plan.schedule) {
    if (d.session === 'rest' || seen.has(d.session)) continue;
    seen.add(d.session);
    const day = effectiveDay(d.session, T, data);
    (day?.exercises || []).forEach((e, index) => out.push({ key: d.session, label: day.label, index, name: e.name }));
  }
  return out;
}

/** Ask again in two weeks. */
export function snoozeCheckIn(data, today) {
  return { ...data, settings: { ...data.settings, checkin_snooze: addDays(today, SNOOZE_DAYS) } };
}

/** Done for this plan. */
export function finishCheckIn(data) {
  const block = activeBlock(data);
  return block ? { ...data, settings: { ...data.settings, checkin_done: block.id } } : data;
}
