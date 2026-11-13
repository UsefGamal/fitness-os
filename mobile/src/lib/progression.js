// Double progression: work up through the plan's rep range at one weight,
// then add weight and start again at the bottom of the range. Pure helper;
// the Workout screen shows its `reason` under the weight.

/** "8-10" -> [8, 10], "12" -> [12, 12], "30s" -> null (timed, no reps). */
export function repRange(reps) {
  const m = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(String(reps ?? ''));
  if (!m) return null;
  const lo = Number(m[1]);
  return [lo, m[2] ? Number(m[2]) : lo];
}

const kgOf = (s) => s.weight_kg || 0;

const fmt = (sets) => {
  const top = Math.max(...sets.map(kgOf));
  const atTop = sets.filter((s) => kgOf(s) === top);
  const reps = atTop.map((s) => s.reps);
  const same = reps.every((r) => r === reps[0]);
  const text = `${atTop.length}×${same ? reps[0] : reps.join('/')}`;
  return top > 0 ? `${text} at ${top} kg` : text;
};

const roundTo = (kg, step) => Math.round(kg / step) * step;

/** The usual weight jump for a move (TRAIN-1): 1 kg for isolation moves,
 * 2 kg for dumbbells and kettlebells (the next pair up), 2.5 kg for
 * barbells and machines. `entry` is the exercise library's entry; without
 * one, `barbell` decides as before (2.5 kg for a barbell, else 1 kg). */
export function stepFor(entry, { barbell = false } = {}) {
  if (!entry) return barbell ? 2.5 : 1;
  if (entry.mechanic === 'isolation') return 1;
  if (entry.equipment === 'dumbbell' || entry.equipment === 'kettlebells') return 2;
  return 2.5;
}

/** Is this a bodyweight move (push-up, plank, pull-up without a belt)? */
export function isBodyweight(entry) {
  return entry?.equipment === 'body only';
}

/** The jump to add on top of `top` kg: the move's step, but never much
 * more than 10% of the load and never under 1 kg. A 12 kg dumbbell goes
 * up 1 kg, not 2; a barbell from 20 kg up keeps its 2.5 kg plates. */
export function jumpFor(top, step = 2.5) {
  if (step === 2.5 && top >= 20) return 2.5;
  return Math.min(step, Math.max(1, Math.round(top * 0.1)));
}

/**
 * What to aim for today.
 *   planReps: the plan's reps ("8-10"); plannedSets: how many work sets
 *   sessions: earlier sessions' sets for this exercise, newest first
 *   step: the usual weight jump (stepFor); the real jump is jumpFor's
 *   bodyweight: true for a bodyweight move, false for one that takes
 *     weight, null when unknown (then a move only ever logged at 0 kg
 *     counts as bodyweight). A bodyweight move done without added weight
 *     never gets "add kg": it progresses by reps, then a harder version.
 * Returns { weightKg, reps, reason, kind: 'start'|'add'|'repeat'|'deload'|'harder' }.
 */
export function progressionTarget(planReps, plannedSets, sessions, { step = 2.5, bodyweight = null } = {}) {
  const range = repRange(planReps);
  const last = sessions[0];
  if (!last?.length) {
    return { weightKg: null, reps: range ? range[0] : null, kind: 'start', reason: range ? `First time: pick a weight you can lift ${range[0]} times with reps to spare.` : 'First time: find a comfortable weight.' };
  }
  const top = Math.max(...last.map(kgOf));
  const atTop = last.filter((s) => kgOf(s) === top);
  const noLoad = top === 0 && bodyweight !== false;
  if (!range) return { weightKg: top, reps: atTop[0].reps, kind: 'repeat', reason: `Last time ${fmt(last)}.` };
  const [lo, hi] = range;

  const missed = (sets) => {
    if (!sets?.length) return false;
    const t = Math.max(...sets.map(kgOf));
    return sets.filter((s) => kgOf(s) === t).some((s) => s.reps < lo);
  };
  if (top > 0 && missed(sessions[0]) && missed(sessions[1])) {
    const kg = Math.max(0, roundTo(top * 0.9, step));
    return { weightKg: kg, reps: hi, kind: 'deload', reason: `Missed ${lo} reps two sessions running: drop 10% to ${kg} kg and build back up.` };
  }
  if (atTop.length >= plannedSets && atTop.every((s) => s.reps >= hi)) {
    if (noLoad) return { weightKg: 0, reps: hi, kind: 'harder', reason: `Last time ${fmt(last)}, all at the top of ${lo}-${hi}: try a harder version, or add a rep.` };
    const add = jumpFor(top, step);
    const kg = Math.round((top + add) * 100) / 100;
    return { weightKg: kg, reps: lo, kind: 'add', reason: `Last time ${fmt(last)}, all at the top of ${lo}-${hi}: add ${add} kg.` };
  }
  const minReps = Math.min(...atTop.map((s) => s.reps));
  const reps = Math.min(hi, Math.max(lo, minReps + 1));
  return { weightKg: top, reps, kind: 'repeat', reason: noLoad ? `Last time ${fmt(last)}: aim for ${reps} reps.` : `Last time ${fmt(last)}: same weight, aim for ${reps} reps.` };
}
