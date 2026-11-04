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

const fmt = (sets) => {
  const top = Math.max(...sets.map((s) => s.weight_kg));
  const atTop = sets.filter((s) => s.weight_kg === top);
  const reps = atTop.map((s) => s.reps);
  const same = reps.every((r) => r === reps[0]);
  return `${atTop.length}×${same ? reps[0] : reps.join('/')} at ${top} kg`;
};

const roundTo = (kg, step) => Math.round(kg / step) * step;

/**
 * What to aim for today.
 *   planReps: the plan's reps ("8-10"); plannedSets: how many work sets
 *   sessions: earlier sessions' sets for this exercise, newest first
 *   step: the weight jump (2.5 kg for big lifts, 1 kg for small ones)
 * Returns { weightKg, reps, reason, kind: 'start'|'add'|'repeat'|'deload' }.
 */
export function progressionTarget(planReps, plannedSets, sessions, { step = 2.5 } = {}) {
  const range = repRange(planReps);
  const last = sessions[0];
  if (!last?.length) {
    return { weightKg: null, reps: range ? range[0] : null, kind: 'start', reason: range ? `First time: pick a weight you can lift ${range[0]} times with reps to spare.` : 'First time: find a comfortable weight.' };
  }
  const top = Math.max(...last.map((s) => s.weight_kg));
  const atTop = last.filter((s) => s.weight_kg === top);
  if (!range) return { weightKg: top, reps: atTop[0].reps, kind: 'repeat', reason: `Last time ${fmt(last)}.` };
  const [lo, hi] = range;

  const missed = (sets) => {
    if (!sets?.length) return false;
    const t = Math.max(...sets.map((s) => s.weight_kg));
    return sets.filter((s) => s.weight_kg === t).some((s) => s.reps < lo);
  };
  if (top > 0 && missed(sessions[0]) && missed(sessions[1])) {
    const kg = Math.max(0, roundTo(top * 0.9, step));
    return { weightKg: kg, reps: hi, kind: 'deload', reason: `Missed ${lo} reps two sessions running: drop 10% to ${kg} kg and build back up.` };
  }
  if (atTop.length >= plannedSets && atTop.every((s) => s.reps >= hi)) {
    const kg = Math.round((top + step) * 100) / 100;
    return { weightKg: kg, reps: lo, kind: 'add', reason: `Last time ${fmt(last)}, all at the top of ${lo}-${hi}: add ${step} kg.` };
  }
  const minReps = Math.min(...atTop.map((s) => s.reps));
  const reps = Math.min(hi, Math.max(lo, minReps + 1));
  return { weightKg: top, reps, kind: 'repeat', reason: `Last time ${fmt(last)}: same weight, aim for ${reps} reps.` };
}
