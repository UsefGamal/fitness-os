// Manual recovery (deload) week, E11-S1. Switched on for one week from Home.
// That week every session keeps its exercises and loads, does about a third
// fewer sets, and stops 1-2 reps further from failure (RIR + 2). Its
// workouts are marked is_deload, count as a full training week, and are left
// out of the progression maths so an easy week never reads as a stall.
// The weeks live on the active block: program.blocks[].deload_weeks holds
// the week-start dates (the Sunday or Monday the week starts on).
import { addDays, fromISO } from './dates.js';
import { activeBlock } from './plan.js';

/** The first day of the week holding `iso`, by the profile's week start. */
export function weekOf(data, iso) {
  const startsMonday = data?.profile?.week_start === 'mon';
  const dow = fromISO(iso).getDay();
  return addDays(iso, -(startsMonday ? (dow + 6) % 7 : dow));
}

export function isRecoveryWeek(data, iso) {
  const weeks = activeBlock(data)?.deload_weeks;
  return Array.isArray(weeks) && weeks.includes(weekOf(data, iso));
}

/** Turn the week holding `iso` into a recovery week, or back. */
export function setRecoveryWeek(data, iso, on) {
  const block = activeBlock(data);
  if (!block) return data;
  const week = weekOf(data, iso);
  const weeks = (block.deload_weeks || []).filter((w) => w !== week);
  const next = { ...block, deload_weeks: on ? [...weeks, week].sort() : weeks };
  return { ...data, program: { ...data.program, blocks: data.program.blocks.map((b) => (b === block ? next : b)) } };
}

/** Sets for a recovery week: a third fewer, at least 1. */
export function recoverySets(sets) {
  const n = Number(sets) || 0;
  return n <= 1 ? n : Math.max(1, Math.round((n * 2) / 3));
}

/** RIR two further from failure: '1-2' -> '3-4', '0' -> '2', none -> '2-3'. */
export function recoveryRir(rir) {
  if (rir == null || rir === '') return '2-3';
  return String(rir).replace(/\d+/g, (d) => String(Number(d) + 2));
}

/** A plan day as it runs in a recovery week. */
export function recoveryDay(day) {
  if (!day) return day;
  return { ...day, recovery: true, exercises: day.exercises.map((e) => ({ ...e, sets: recoverySets(e.sets), rir: recoveryRir(e.rir) })) };
}

/** Workouts' history without recovery-week sessions, for progression. */
export function withoutRecovery(history, workouts) {
  const easy = new Set(workouts.filter((w) => w.is_deload).map((w) => w.id));
  return history.filter((h) => !easy.has(h.workoutId));
}
