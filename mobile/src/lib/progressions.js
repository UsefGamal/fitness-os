// Easier and harder versions of a bodyweight move (content/progressions.py).
// The exercise page asks where a move sits on its ladder and shows the
// steps around it. Names match without case or extra spaces, so "push-up"
// from an older custom exercise still finds the push-up ladder.
// Pure; progressions.test.js.

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** The ladder `name` is on and its step index, or null.
 * @param {string} name
 * @param {any[]} ladders content.training.progressions */
export function ladderFor(name, ladders) {
  const want = norm(name);
  if (!want || !Array.isArray(ladders)) return null;
  for (const ladder of ladders) {
    const index = (ladder.steps || []).findIndex((s) => norm(s.name) === want);
    if (index >= 0) return { ladder, index };
  }
  return null;
}

/** The step just below and just above `name` on its ladder (either may be
 * null at the ends), or null when the move isn't on a ladder. */
export function neighbours(name, ladders) {
  const found = ladderFor(name, ladders);
  if (!found) return null;
  const { ladder, index } = found;
  return {
    ladder,
    index,
    easier: ladder.steps[index - 1] ?? null,
    harder: ladder.steps[index + 1] ?? null,
  };
}

/** The ladder's steps, each with where it sits relative to `index`:
 * 'easier', 'current' or 'harder'. */
export function ladderRows(ladder, index) {
  return (ladder?.steps || []).map((step, i) => ({
    ...step,
    level: i + 1,
    place: i < index ? 'easier' : i === index ? 'current' : 'harder',
  }));
}

/** Library exercise id for a step's name, so the row can open its page.
 * @param {import('../types').Exercise[]} exercises */
export function exerciseIdFor(name, exercises) {
  const want = norm(name);
  const hit = (exercises || []).find((e) => norm(e.name) === want);
  return hit ? hit.id : null;
}
