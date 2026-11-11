// Swipe left or right to move between the main tabs (Yusuf, 11 Nov 2026).
// The page follows the finger; letting go far enough, or with a flick,
// opens the tab next to it. Pure rules here; components/useSwipeTabs.js
// wires them to touch events. swipeNav.test.js.

/** The tab paths in the tab bar's order. With the Meals module off the
 * Library takes its place (see TabBar.jsx). */
export function tabPaths(mealsOn = true) {
  return ['/', '/plan', '/workout', mealsOn ? '/meals' : '/library', '/stats'];
}

export const DRAG = {
  slop: 10, // px of movement before a drag is read as sideways or up/down
  ratio: 1.5, // sideways must beat up/down by this much to take the page
  commit: 0.3, // share of the screen width that opens the next tab
  flickPx: 40, // a flick needs at least this much travel...
  flickSpeed: 0.5, // ...at this many px per ms
  resist: 0.25, // how far the page moves at the first or last tab
  out: 0.6, // share of the width the page slides out by before the next one comes in
  outMs: 130,
  backMs: 200,
  edge: 24, // px from a screen edge left to Android's own back gesture
};

/** Which way a drag is going once it has moved enough: 'x' (the page
 * follows), 'y' (the page scrolls, the swipe is off) or null (too early). */
export function dragLock(dx, dy) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < DRAG.slop) return null;
  return ax >= DRAG.ratio * ay ? 'x' : 'y';
}

/** The tab next to `pathname`, or null at either end and off the tabs.
 * Forward is towards the start of the line: a swipe left in English, right
 * in Arabic, like turning a page. No wrap-around. */
export function neighbourTab(pathname, forward, tabs = tabPaths()) {
  const i = tabs.indexOf(pathname);
  if (i < 0) return null;
  return tabs[i + (forward ? 1 : -1)] || null;
}

/** How far the page sits from rest while dragged by `dx`: with the finger
 * when a tab is there to open, a quarter of the way when not. */
export function dragOffset(dx, open) {
  return Math.round((open ? dx : dx * DRAG.resist) * 10) / 10;
}

/** Does letting go here open the next tab? Far enough, or a quick flick. */
export function swipeCommits({ dx, ms, width }) {
  const ax = Math.abs(dx);
  if (width > 0 && ax >= width * DRAG.commit) return true;
  return ax >= DRAG.flickPx && ms > 0 && ax / ms >= DRAG.flickSpeed;
}
