// Interval sessions with moves: each work round plays one move (round 1 the
// first move, round 2 the second, starting over after the last), so the
// timer can show the move's photo and the notification can name it. What
// was done is saved as a cardio session with one row per move and the
// rounds it got. Pure helpers, tested in intervals.test.js.
import { clock } from './training.js';

export const MAX_MOVES = 12;
// A work round counts once half of it has gone by.
const COUNTS_AFTER = 0.5;

export const PHASE_LABEL = { warmup: 'Warm up', work: 'Work', rest: 'Rest', setrest: 'Set rest', cooldown: 'Cool down' };

/** The moves a preset starts with (content/interval_program.py), or none
 * for a custom set. @param {any} training @param {string} key @returns {string[]} */
export function presetMoves(training, key) {
  const list = training?.intervals?.preset_moves?.[key];
  return Array.isArray(list) ? list.slice(0, MAX_MOVES) : [];
}

/** Every move the timer offers, the preset moves first. @param {any} training @returns {string[]} */
export function movePool(training) {
  return Array.isArray(training?.intervals?.moves) ? training.intervals.moves : [];
}

/** How many work steps come before step `index`. */
export function workBefore(steps, index) {
  let n = 0;
  for (let i = 0; i < index && i < steps.length; i += 1) if (steps[i].kind === 'work') n += 1;
  return n;
}

/** The move of work step `index`, or null (a rest, or no moves). */
export function moveAt(steps, index, moves) {
  if (!moves?.length || steps[index]?.kind !== 'work') return null;
  return moves[workBefore(steps, index) % moves.length];
}

/** The next move after step `index` (what a rest is getting ready for). */
export function nextMove(steps, index, moves) {
  for (let i = index + 1; i < steps.length; i += 1) if (steps[i].kind === 'work') return moveAt(steps, i, moves);
  return null;
}

/** What the screen and the notification say for step `index`:
 * { title, detail }. Work: the move (or "Work") and "Round 3 of 10 · Next:
 * Rest 0:30". A rest: "Rest" and "Next: Push-up". */
export function intervalLines(steps, index, moves, { sets = 1 } = {}) {
  const step = steps[index];
  if (!step) return null;
  const works = steps.filter((s) => s.kind === 'work').length;
  const coming = nextMove(steps, index, moves);
  const after = steps[index + 1];
  if (step.kind === 'work') {
    const round = `Round ${workBefore(steps, index) + 1} of ${works}${sets > 1 ? ` · set ${step.set} of ${sets}` : ''}`;
    const next = after ? `Next: ${PHASE_LABEL[after.kind]}${after.kind === 'work' && coming ? ` (${coming})` : ''} ${clock(after.seconds)}` : 'Last one';
    return { title: moveAt(steps, index, moves) || PHASE_LABEL.work, detail: `${round} · ${next}` };
  }
  if (step.kind === 'cooldown') return { title: PHASE_LABEL.cooldown, detail: 'Nice work, ease off' };
  return { title: PHASE_LABEL[step.kind], detail: coming ? `Next: ${coming}` : after ? `Next: ${PHASE_LABEL[after.kind]}` : 'Last one' };
}

/** Work rounds done after `elapsedS` seconds: { rounds, byMove: [[name, n]] }
 * in the order the moves first came. A round counts once half of it is
 * done. Without moves, byMove is empty. */
export function roundsDone(steps, elapsedS, moves) {
  let t = 0;
  let rounds = 0;
  /** @type {Map<string, number>} */
  const byMove = new Map();
  for (let i = 0; i < steps.length; i += 1) {
    const s = steps[i];
    if (s.kind === 'work' && elapsedS >= t + s.seconds * COUNTS_AFTER) {
      rounds += 1;
      const m = moveAt(steps, i, moves);
      if (m) byMove.set(m, (byMove.get(m) || 0) + 1);
    }
    t += s.seconds;
    if (t > elapsedS) break;
  }
  return { rounds, byMove: [...byMove] };
}

/** What to save for an interval run: the logSession fields plus the
 * `intervals` summary. Null when not even one round was done. */
export function intervalLog({ config, moves, steps, elapsedS }) {
  const { rounds, byMove } = roundsDone(steps, elapsedS, moves);
  if (!rounds) return null;
  return {
    type: 'cardio',
    label: config.label || 'Intervals',
    durationMin: Math.max(1, Math.round(elapsedS / 60)),
    checklist: byMove.map(([name, n]) => ({ item_name: name, completed: true, reps_achieved: n })),
    intervals: { preset: config.key || 'custom', rounds, work_s: config.work, rest_s: config.rest },
  };
}

/** Add or take out a move, keeping at most MAX_MOVES. */
export function toggleMove(moves, name) {
  if (moves.includes(name)) return moves.filter((m) => m !== name);
  return moves.length >= MAX_MOVES ? moves : [...moves, name];
}
