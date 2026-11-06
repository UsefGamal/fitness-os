// Ready-made routines (E4-S18). content.training.routines holds the
// templates (content/routines.py); switching to one ends the running plan
// block and starts a new block with its own copy of the sessions and week,
// so workouts already logged keep pointing at the block they were done on.

import { addCustomExercise, exerciseByName } from './data.js';
import { addDays } from './dates.js';
import { activeBlock } from './plan.js';

/** The plans someone can switch to: the build's own plan first, then the
 * ready-made routines (without a duplicate of the build's plan). */
export function routinesOf(content) {
  const T = content.training;
  const own = {
    id: T.trainer_plan.id ?? 'ul-ppl',
    name: T.trainer_plan.name || 'Your plan',
    about: null,
    level: null,
    place: 'gym',
    days: T.trainer_plan.schedule.filter((d) => d.session !== 'rest').length,
    schedule: T.trainer_plan.schedule,
    program: T.program,
    own: true,
  };
  return [own, ...(T.routines || []).filter((r) => r.id !== own.id)];
}

export function routineById(content, id) {
  return routinesOf(content).find((r) => r.id === id) || null;
}

/** The template the running block came from, or null for a hand-made one. */
export function templateOfBlock(data, content) {
  const block = activeBlock(data);
  return block ? routineById(content, block.template_id) : null;
}

/** Days of the week that train, e.g. ['sunday', 'tuesday', 'thursday']. */
export function trainingDays(routine) {
  return routine.schedule.filter((d) => d.session !== 'rest').map((d) => d.day);
}

/** Every exercise of a routine in the Library, so each one can be logged. */
function withExercises(data, routine) {
  let out = data;
  for (const day of routine.program) {
    for (const ex of day.exercises) {
      if (!exerciseByName(out, ex.name)) out = addCustomExercise(out, { name: ex.name, muscle_group: ex.group || 'Other', equipment: ex.bodyweight ? 'Body Only' : null });
    }
  }
  return out;
}

/** Switch to routine `id` from `today` on. The running block ends
 * yesterday (or is replaced when it started today and has no workouts),
 * one-off day changes from today on are dropped, and older blocks stay so
 * history keeps its labels. Returns `data` unchanged for an unknown id. */
export function startRoutine(data, content, id, today) {
  const routine = routineById(content, id);
  if (!routine) return data;
  const blocks = data.program?.blocks || [];
  const current = activeBlock(data);
  const untouched = current && current.started_on === today && !data.workouts.some((w) => w.block_id === current.id);
  const kept = blocks
    .filter((b) => !(untouched && b === current))
    .map((b) => (b === current ? { ...b, ended_on: b.started_on >= today ? today : addDays(today, -1) } : b));
  const n = blocks.reduce((m, b) => Math.max(m, Number(String(b.id).replace(/\D/g, '')) || 0), 0) + 1;
  const block = {
    id: `b${n}`,
    template_id: routine.id,
    name: routine.name,
    template_version: content.version ?? 1,
    started_on: today,
    ended_on: null,
    schedule: routine.schedule.map((d) => ({ ...d })),
    sessions: structuredClone(routine.program),
    // Back to a plan followed before: its exercise edits come back too.
    overrides: structuredClone([...blocks].reverse().find((b) => b.template_id === routine.id)?.overrides || {}),
    deload_weeks: [],
  };
  return withExercises({
    ...data,
    // Past one-off changes stay as history, but only if the new plan has
    // that session; the rest would point at a session that no longer exists.
    session_moves: (data.session_moves || []).filter((m) => m.to < today && (m.key === 'rest' || routine.program.some((d) => d.key === m.key))),
    program: { ...(data.program || { schedule_mode: 'weekdays' }), active_block: block.id, blocks: [...kept, block] },
  }, routine);
}

