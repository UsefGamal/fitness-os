// Changes made during one workout that leave the plan alone: an extra set,
// skipping an exercise to the end, reordering, or swapping in another
// exercise (machine taken). Stored on the workout as `tweaks`; pure helpers.
//   tweaks = { order: [original index...], extra: { [orig]: n }, swaps: { [orig]: name },
//              pairs: { [orig]: letter | '' } }   ('' = not in a superset today)

export function emptyTweaks(n) {
  return { order: Array.from({ length: n }, (_, i) => i), extra: {}, swaps: {}, pairs: {} };
}

function norm(tweaks, n) {
  const t = tweaks && Array.isArray(tweaks.order) ? tweaks : emptyTweaks(n);
  // The plan may have changed since: keep known indexes, append new ones.
  const order = t.order.filter((i) => i < n);
  for (let i = 0; i < n; i += 1) if (!order.includes(i)) order.push(i);
  return { order, extra: t.extra || {}, swaps: t.swaps || {}, pairs: t.pairs || {} };
}

/** The day as it runs today: exercises in the tweaked order, swapped names,
 * extra sets added. Each exercise keeps `orig` (its index in the plan). */
export function applyTweaks(day, tweaks) {
  const t = norm(tweaks, day.exercises.length);
  return {
    ...day,
    exercises: t.order.map((i) => {
      const ex = day.exercises[i];
      const swapped = t.swaps[i];
      const paired = i in t.pairs ? withPair(ex, t.pairs[i]) : ex;
      return {
        ...paired,
        orig: i,
        sets: ex.sets + (t.extra[i] || 0),
        ...(swapped ? { name: swapped, swapped_from: ex.name, video: null, note: null, alternative: null } : {}),
      };
    }),
  };
}

function withPair(ex, letter) {
  const { pair, ...rest } = ex;
  if (letter) return { ...rest, pair: letter, type: 'paired' };
  return rest.type === 'paired' ? { ...rest, type: 'normal' } : rest;
}

/** Store today's supersets from `list`, the day as it runs (applyTweaks,
 * each exercise with its `orig`) after pairWithNext or unpair. */
export function pairsFrom(tweaks, n, list) {
  const t = norm(tweaks, n);
  const pairs = {};
  for (const e of list) if (Number.isInteger(e.orig)) pairs[e.orig] = e.pair?.[0] || '';
  return { ...t, pairs };
}

export function addExtraSet(tweaks, n, orig) {
  const t = norm(tweaks, n);
  return { ...t, extra: { ...t.extra, [orig]: (t.extra[orig] || 0) + 1 } };
}

/** Move the exercise at display position `pos` to the end. */
export function skipToEnd(tweaks, n, pos) {
  const t = norm(tweaks, n);
  const order = [...t.order];
  const [i] = order.splice(pos, 1);
  order.push(i);
  return { ...t, order };
}

export function moveBy(tweaks, n, pos, dir) {
  const t = norm(tweaks, n);
  const to = pos + dir;
  if (to < 0 || to >= t.order.length) return t;
  const order = [...t.order];
  [order[pos], order[to]] = [order[to], order[pos]];
  return { ...t, order };
}

export function swapFor(tweaks, n, orig, name) {
  const t = norm(tweaks, n);
  const swaps = { ...t.swaps };
  if (name) swaps[orig] = name;
  else delete swaps[orig];
  return { ...t, swaps };
}

/** Store tweaks on a workout. */
export function setTweaks(data, workoutId, tweaks) {
  return { ...data, workouts: data.workouts.map((w) => (w.id === workoutId ? { ...w, tweaks } : w)) };
}

// ── Notes per exercise, shown next time (seat height, grip, pin) ─────

export function exerciseNote(data, name) {
  return data.exercise_notes?.[name] || '';
}

export function setExerciseNote(data, name, text) {
  const notes = { ...(data.exercise_notes || {}) };
  const clean = text.trim().slice(0, 200);
  if (clean) notes[name] = clean;
  else delete notes[name];
  return { ...data, exercise_notes: notes };
}
