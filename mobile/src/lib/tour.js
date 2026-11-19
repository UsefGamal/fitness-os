// The guided tour (ONB-3, 19 Nov 2026): after first-time setup, Home dims
// and a spotlight walks over the main controls, one tip at a time. Tap Next
// (or the lit control, or anywhere on the dim) to go on; Skip ends it. It
// shows once, and Settings > Help can play it again. Pure; tour.test.js.

/** The stops in order. `target` is the control's data-tour name; null is
 * a card in the middle with no spotlight. Text is i18n tour.<id>.title
 * and tour.<id>.body. A stop whose control isn't on screen (the Meals tab
 * with Meals off, the weight card with weight hidden) is left out. */
export const TOUR = [
  { id: 'hello', target: null },
  { id: 'workout', target: 'workout' },
  { id: 'today', target: 'today' },
  { id: 'weight', target: 'weight' },
  { id: 'plan', target: 'tab-plan' },
  { id: 'start', target: 'tab-workout' },
  { id: 'meals', target: 'tab-meals' },
  { id: 'library', target: 'tab-library' },
  { id: 'stats', target: 'tab-stats' },
  { id: 'settings', target: 'settings' },
];

/** The stops whose control is on screen now (`present`: data-tour names). */
export function tourStops(present) {
  const on = new Set(present);
  return TOUR.filter((s) => s.target == null || on.has(s.target));
}

/** Should the tour play now? Only on a phone that went through setup
 * (Yusuf's own phone never did), never during a workout, and once. */
export function tourDue(data, { workoutActive = false } = {}) {
  if (!data?.setup?.done_on || workoutActive) return false;
  return !data.settings?.tour?.done_on;
}

/** Seen (finished or skipped): it doesn't come back by itself. */
export function finishTour(data, today, { skipped = false } = {}) {
  return { ...data, settings: { ...data.settings, tour: { done_on: today, ...(skipped ? { skipped: true } : {}) } } };
}

/** "Show the tour again" in Help. A phone that never ran setup (an older
 * install) gets a setup stamp too, so the tour can play there. */
export function replayTour(data, today) {
  const setup = data.setup?.done_on ? data.setup : { ...(data.setup || {}), done_on: today };
  return { ...data, setup, settings: { ...data.settings, tour: {} } };
}

const GAP = 12; // between the lit control and the tip
const EDGE = 16;

/** Where the tip card goes: under the control when it fits, else above.
 * `rect` { top, bottom } in px, `view` { height, top, bottom } (the safe
 * area), `tip` the card's height. Returns { top } for the card, or a
 * middle placement when there is no control. */
export function placeTip(rect, view, tip) {
  const top = view.top ?? 0;
  const bottom = view.height - (view.bottom ?? 0);
  if (!rect) return { top: Math.max(top + EDGE, Math.round((view.height - tip) / 2)), side: 'middle' };
  const below = rect.bottom + GAP;
  if (below + tip <= bottom - EDGE) return { top: Math.round(below), side: 'below' };
  const above = rect.top - GAP - tip;
  if (above >= top + EDGE) return { top: Math.round(above), side: 'above' };
  // Neither fits (a tall card): over the control's lower part, on screen.
  return { top: Math.round(Math.max(top + EDGE, bottom - EDGE - tip)), side: 'over' };
}
