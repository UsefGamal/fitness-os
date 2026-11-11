import { useRef } from 'react';
import { useNavigate } from 'react-router';

import { overlayCount } from '../lib/overlays.js';
import { swipeTarget } from '../lib/swipeNav.js';

// Things that use a sideways drag themselves, or where a slip would hurt:
// swipeable set rows, fields, segmented controls, charts you can scrub,
// anything marked data-noswipe, and the set being logged in a workout.
const OWN_DRAG = '.swipe, input, textarea, select, .seg, .stepper, .sheet-wrap, .ex-card.current, [data-noswipe]';

function scrollsSideways(el, stop) {
  for (let n = el; n && n !== stop && n.nodeType === 1; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 4) {
      const o = getComputedStyle(n).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
  }
  return false;
}

/** Touch handlers for the page area: a quick sideways swipe on a tab page
 * opens the tab next to it. Returns props to spread on the element. */
export default function useSwipeTabs(pathname, { rtl, tabs }) {
  const navigate = useNavigate();
  const start = useRef(null);
  const onTouchStart = (e) => {
    start.current = null;
    if (e.touches.length !== 1 || overlayCount() > 0) return;
    const target = e.target;
    if (target.closest?.(OWN_DRAG) || scrollsSideways(target, e.currentTarget)) return;
    const p = e.touches[0];
    start.current = { x: p.clientX, y: p.clientY, at: Date.now() };
  };
  const onTouchEnd = (e) => {
    const s = start.current;
    start.current = null;
    if (!s || overlayCount() > 0) return;
    const p = e.changedTouches[0];
    const hit = swipeTarget(pathname, { dx: p.clientX - s.x, dy: p.clientY - s.y, ms: Date.now() - s.at, startX: s.x, width: window.innerWidth }, { rtl, tabs });
    if (hit) navigate(hit.to, { state: { swipe: hit.forward ? 'forward' : 'back' } });
  };
  const onTouchCancel = () => { start.current = null; };
  return { onTouchStart, onTouchEnd, onTouchCancel };
}
