import { useRef } from 'react';
import { useNavigate } from 'react-router';

import { overlayCount } from '../lib/overlays.js';
import { DRAG, dragLock, dragOffset, neighbourTab, swipeCommits } from '../lib/swipeNav.js';

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

const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Touch handlers for the page area: drag a tab page sideways and it
 * follows the finger; let go past a third of the screen (or flick) and the
 * tab next to it opens, otherwise the page settles back. The page keeps
 * scrolling up and down as usual (`touch-action: pan-y` in styles.css).
 * Returns props to spread on the element. */
export default function useSwipeTabs(pathname, { rtl, tabs }) {
  const navigate = useNavigate();
  const g = useRef(null); // { x, y, at, el, lock, dx }

  const settle = (el, x, ms) => {
    el.style.transition = ms ? `transform ${ms}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${ms}ms linear` : '';
    el.style.transform = x ? `translate3d(${x}px, 0, 0)` : '';
    if (!x) el.style.opacity = '';
  };
  const reset = (el) => {
    settle(el, 0, DRAG.backMs);
    setTimeout(() => { if (!g.current) { el.style.transition = ''; el.style.willChange = ''; } }, DRAG.backMs + 20);
  };

  const onTouchStart = (e) => {
    g.current = null;
    if (e.touches.length !== 1 || overlayCount() > 0 || !tabs.includes(pathname)) return;
    const target = e.target;
    if (target.closest?.(OWN_DRAG) || scrollsSideways(target, e.currentTarget)) return;
    const p = e.touches[0];
    const width = window.innerWidth;
    if (p.clientX < DRAG.edge || p.clientX > width - DRAG.edge) return; // Android's own back gesture
    g.current = { x: p.clientX, y: p.clientY, at: Date.now(), el: e.currentTarget, lock: null, dx: 0, width };
  };

  const onTouchMove = (e) => {
    const s = g.current;
    if (!s) return;
    if (e.touches.length !== 1) { g.current = null; if (s.lock === 'x') reset(s.el); return; }
    const p = e.touches[0];
    const dx = p.clientX - s.x;
    if (!s.lock) {
      s.lock = dragLock(dx, p.clientY - s.y);
      if (s.lock === 'y') { g.current = null; return; }
      if (s.lock !== 'x') return;
      s.el.style.willChange = 'transform';
      s.el.style.transition = '';
    }
    s.dx = dx;
    const forward = rtl ? dx > 0 : dx < 0;
    const open = Boolean(neighbourTab(pathname, forward, tabs));
    if (!calm()) s.el.style.transform = `translate3d(${dragOffset(dx, open)}px, 0, 0)`;
  };

  const onTouchEnd = () => {
    const s = g.current;
    g.current = null;
    if (!s || s.lock !== 'x') return;
    const forward = rtl ? s.dx > 0 : s.dx < 0;
    const to = neighbourTab(pathname, forward, tabs);
    if (!to || overlayCount() > 0 || !swipeCommits({ dx: s.dx, ms: Date.now() - s.at, width: s.width })) { reset(s.el); return; }
    const go = () => navigate(to, { state: { swipe: forward ? 'forward' : 'back' } });
    if (calm()) { go(); return; }
    // Slide the page the rest of the way out, then show the next one coming in.
    s.el.style.opacity = '0.4';
    settle(s.el, Math.sign(s.dx) * s.width * DRAG.out, DRAG.outMs);
    setTimeout(go, DRAG.outMs);
  };

  const onTouchCancel = () => {
    const s = g.current;
    g.current = null;
    if (s && s.lock === 'x') reset(s.el);
  };
  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
