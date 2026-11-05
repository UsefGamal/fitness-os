// Stretch and mobility follow-along: a list of lines from the plan
// ("5 min hamstring stretch", "Chest doorway stretch, 30s/side",
// "Wall Slide 1x10") becomes timed steps that play one after another with
// the interval sounds. Pure helpers, tested in followAlong.test.js.

export const DEFAULT_HOLD = 30;

/** Seconds and sides for one line: { seconds, sides }. Minutes and seconds
 * written in the line win (the first number of a range); otherwise the
 * default hold. "/side" or "each side" plays it twice. */
export function timing(line, fallback = DEFAULT_HOLD) {
  const sides = /\/\s*side|each side|per side/i.test(line) ? 2 : 1;
  const min = line.match(/(\d+(?:\.\d+)?)\s*(?:-\s*\d+\s*)?min/i);
  if (min) return { seconds: Math.round(Number(min[1]) * 60), sides: 1 };
  const sec = line.match(/(\d+)\s*(?:-\s*\d+\s*)?(?:s|sec|seconds)\b/i);
  if (sec) return { seconds: Number(sec[1]), sides };
  return { seconds: fallback, sides };
}

/** A name to find a photo by: the line without amounts ("Wall Slide"). */
export function moveName(line) {
  return line.replace(/[,(].*$/, '').replace(/\s+\d.*$/, '').replace(/\s+x\d.*$/i, '').trim();
}

/** The line without the move's name, for under the name: "1x10-12",
 * "30s/side". Empty when the line is only the name. */
export function amountOf(step) {
  const rest = step.label.startsWith(step.name) ? step.label.slice(step.name.length) : step.label;
  return rest.replace(/^[\s,:-]+/, '').trim();
}

/** Steps for a list of lines: [{ label, name, seconds, side? }]. A short
 * "Switch" isn't added: the side label and the new-step chime say it. */
export function followSteps(lines, { hold = DEFAULT_HOLD } = {}) {
  const steps = [];
  for (const line of lines) {
    const { seconds, sides } = timing(line, hold);
    const name = moveName(line);
    if (sides === 2) {
      steps.push({ label: line, name, seconds, side: 'Left side' });
      steps.push({ label: line, name, seconds, side: 'Right side' });
    } else steps.push({ label: line, name, seconds });
  }
  return steps;
}

/** The elapsed seconds at which step `index` starts (for Skip and Back). */
export function startOf(steps, index) {
  return steps.slice(0, Math.max(0, index)).reduce((n, s) => n + s.seconds, 0);
}
