// Swipe left or right to move between the main tabs (Yusuf, 11 Nov 2026).
// Pure rules here; components/useSwipeTabs.js wires them to touch events.
// swipeNav.test.js.

/** The tab paths in the tab bar's order. With the Meals module off the
 * Library takes its place (see TabBar.jsx). */
export function tabPaths(mealsOn = true) {
  return ['/', '/plan', '/workout', mealsOn ? '/meals' : '/library', '/stats'];
}

export const SWIPE = {
  min: 72, // px sideways before it counts
  ratio: 2, // at least this much more sideways than up or down
  maxMs: 700, // a slow drag is reading or scrolling, not a swipe
  edge: 24, // px from a screen edge left to Android's own back gesture
};

/** Where a swipe leads, or null. `g`: { dx, dy, ms, startX, width }.
 * Swiping towards the start of the line (left in English, right in
 * Arabic) opens the next tab, like turning a page. No wrap-around. */
export function swipeTarget(pathname, g, { rtl = false, tabs = tabPaths() } = {}) {
  const i = tabs.indexOf(pathname);
  if (i < 0 || !g) return null;
  const { dx, dy, ms, startX, width } = g;
  if (!(Math.abs(dx) >= SWIPE.min) || Math.abs(dx) < SWIPE.ratio * Math.abs(dy)) return null;
  if (ms > SWIPE.maxMs) return null;
  if (width > 0 && (startX < SWIPE.edge || startX > width - SWIPE.edge)) return null;
  const forward = rtl ? dx > 0 : dx < 0;
  const next = i + (forward ? 1 : -1);
  return next >= 0 && next < tabs.length ? { to: tabs[next], forward } : null;
}
