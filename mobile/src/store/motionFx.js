// MOVE-1: the app-wide motion that isn't tied to one screen. One listener per
// kind on the document, installed once from App.jsx, so no component has to
// know about it:
//   - press glow: buttons light up from the point the finger touched
//   - segment glide: the highlight in a segmented control slides to the new tab
//   - feedback visuals: a record bursts green and gold sparks where you
//     tapped, a saved workout washes the screen green (feedback.js dispatches)
//   - card morph: a tapped card grows into the page it opens (View Transitions)
//   - predictive back: the page shrinks as the Android back swipe moves
// Everything here is transform and opacity only, and all of it is skipped
// with the phone's "Remove animations" setting.

const PRESS = '.btn, .mini-btn, .chip-btn, .pill-btn, .tbtn, .st-tick, button.chip, .tpre';
const MORPH = '.ex-row, .ex-card, .list-row, .stat-tile, .quick, .meal-card, .hero-link';

// The phone's setting, or the app's own switch (Settings > Look, MOVE-2).
export const reducedMotion = () => globalThis.document?.documentElement?.dataset?.motion === 'reduce'
  || Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

let last = { x: innerWidth / 2, y: innerHeight / 2 };

function pressGlow(e) {
  last = { x: e.clientX, y: e.clientY };
  const el = e.target.closest?.(PRESS);
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--px', `${e.clientX - r.left}px`);
  el.style.setProperty('--py', `${e.clientY - r.top}px`);
  el.classList.remove('glow');
  // Restart the glow on a second quick tap.
  void el.offsetWidth;
  el.classList.add('glow');
  setTimeout(() => el.classList.remove('glow'), 520);
}

/** The highlight of a segmented control slides from the old tab to the new
 * one (FLIP: React moves the .on class, then the new one animates from where
 * the old one was). */
function segGlide(e) {
  const btn = e.target.closest?.('.seg button');
  if (!btn || reducedMotion()) return;
  const seg = btn.parentElement;
  const old = seg.querySelector('button.on');
  if (!old || old === btn) return;
  const from = old.getBoundingClientRect();
  requestAnimationFrame(() => {
    const now = seg.querySelector('button.on');
    if (!now || now === old) return;
    const to = now.getBoundingClientRect();
    now.animate?.([
      { transform: `translateX(${from.left - to.left}px) scaleX(${from.width / to.width})`, transformOrigin: 'left center' },
      { transform: 'none', transformOrigin: 'left center' },
    ], { duration: 280, easing: 'cubic-bezier(.3, 1.3, .5, 1)' });
  });
}

/** A short burst of sparks at a point: a new record (MOVE-1, colour 7). */
export function sparks(x = last.x, y = last.y) {
  if (reducedMotion()) return;
  const box = document.createElement('div');
  box.className = 'sparks';
  box.setAttribute('aria-hidden', 'true');
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  for (let i = 0; i < 14; i += 1) {
    const s = document.createElement('i');
    const a = (i / 14) * Math.PI * 2;
    const d = 46 + (i % 3) * 18;
    s.style.setProperty('--dx', `${Math.round(Math.cos(a) * d)}px`);
    s.style.setProperty('--dy', `${Math.round(Math.sin(a) * d)}px`);
    if (i % 2) s.className = 'gold';
    box.append(s);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 900);
}

/** A soft green wash over the whole screen: a workout saved. */
export function wash() {
  if (reducedMotion()) return;
  const el = document.createElement('div');
  el.className = 'wash';
  el.setAttribute('aria-hidden', 'true');
  el.style.setProperty('--wx', `${last.x}px`);
  el.style.setProperty('--wy', `${last.y}px`);
  document.body.append(el);
  setTimeout(() => el.remove(), 1000);
}

function onFeedback(e) {
  const kind = e.detail;
  if (kind === 'pr') sparks();
  else if (kind === 'workoutSaved' || kind === 'mealsDone') wash();
}

/** Card morph (shared element): the tapped card is the "old" hero and the
 * new page the "new" one, so the card grows into the page. Only for links
 * inside the app, not the tab bar, and only where the browser can do it. */
function morphClick(e, navigate) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest?.('a[href^="#/"]');
  if (!a || a.closest('.tabbar, .sheet, .no-morph')) return;
  const card = a.matches(MORPH) ? a : a.querySelector(MORPH) || a.closest(MORPH);
  if (!card || !document.startViewTransition || reducedMotion()) return;
  e.preventDefault();
  e.stopPropagation();
  const to = a.getAttribute('href').slice(1);
  card.style.viewTransitionName = 'hero';
  const root = document.documentElement;
  root.classList.add('vt-morph');
  const vt = document.startViewTransition(() => new Promise((resolve) => {
    card.style.viewTransitionName = '';
    pendingMorph = resolve;
    navigate(to);
    // Never hold the screen if the page takes long to appear.
    setTimeout(() => { if (pendingMorph === resolve) { pendingMorph = null; resolve(); } }, 450);
  }));
  vt.finished.finally(() => {
    root.classList.remove('vt-morph');
    document.querySelectorAll('.route').forEach((r) => { r.style.viewTransitionName = ''; });
  });
}

let pendingMorph = null;
/** Called by the Shell once the new page is on screen (layout effect): it
 * becomes the "new" hero and the transition starts. */
export function morphLanded(routeEl) {
  if (!pendingMorph || !routeEl) return;
  routeEl.style.viewTransitionName = 'hero';
  const done = pendingMorph;
  pendingMorph = null;
  done();
}

/** Predictive back (Android 14+): MainActivity sends the swipe's progress;
 * the page shrinks towards the edge it is swiped from, with rounded corners,
 * and springs back if the swipe is let go early. */
function predictiveBack(phase, progress = 0, edge = 0) {
  const route = document.querySelector('.route');
  if (!route || reducedMotion()) return;
  if (phase === 'progress') {
    const p = Math.min(1, Math.max(0, progress));
    const dir = edge === 1 ? -1 : 1;
    route.style.transition = 'none';
    route.style.transform = `translateX(${dir * p * 24}px) scale(${1 - p * 0.08})`;
    route.style.borderRadius = `${Math.round(p * 28)}px`;
    route.classList.add('backing');
  } else {
    route.style.transition = 'transform 260ms cubic-bezier(.3, 1.3, .5, 1), border-radius 260ms ease';
    route.style.transform = '';
    route.style.borderRadius = '';
    setTimeout(() => { route.classList.remove('backing'); route.style.transition = ''; }, 280);
  }
}

/** MOVE-2: the old page leaves while the new one comes in. React has already
 * swapped the page by the time anything runs, so a copy of the old one is
 * taken just before it goes (App.jsx calls this from the route's ref) and
 * animated away: 'push' slides it a little left under the new page, 'pop'
 * slides it right off the top, solid (continuing a predictive back swipe). The copy
 * can't be tapped or read by TalkBack and is removed when it ends. */
export const GHOST_MS = 220;
export function ghostOut(node, kind) {
  if (!node || !kind || reducedMotion() || typeof document === 'undefined') return;
  if (document.documentElement.classList.contains('vt-morph')) return; // the card morph has it
  const box = node.getBoundingClientRect();
  const wrap = document.createElement('div');
  wrap.className = `route-ghost ${kind}`;
  wrap.setAttribute('aria-hidden', 'true');
  wrap.inert = true;
  const copy = node.cloneNode(true);
  // Not a .route any more, so nothing looking for the live page finds it.
  copy.className = [...node.classList].filter((c) => c === 'with-timer' || c === 'with-pill').concat('route-ghost-page').join(' ');
  copy.removeAttribute('style');
  copy.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  copy.style.top = `${box.top}px`;
  const from = node.classList.contains('backing') ? node.style.transform || 'none' : 'none';
  wrap.appendChild(copy);
  document.body.appendChild(wrap);
  const rtl = document.documentElement.dir === 'rtl' ? -1 : 1;
  const frames = kind === 'pop'
    // Solid while it slides away, like a card being pulled off the top.
    ? [{ transform: from, opacity: 1 }, { transform: `translateX(${rtl * 100}%)`, opacity: 0.9 }]
    : [{ transform: 'none', opacity: 1 }, { transform: `translateX(${rtl * -18}%)`, opacity: 0 }];
  const anim = wrap.animate(frames, { duration: GHOST_MS, easing: kind === 'pop' ? 'cubic-bezier(.4, 0, 1, 1)' : 'cubic-bezier(.2, 0, 0, 1)', fill: 'forwards' });
  const done = () => wrap.remove();
  anim.onfinish = done;
  setTimeout(done, GHOST_MS + 200);
}

let installed = false;
/** Install the listeners once. `navigate` is the router's navigate. */
export function installMotion(navigate) {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('pointerdown', pressGlow, { passive: true, capture: true });
  document.addEventListener('click', segGlide, { capture: true });
  document.addEventListener('click', (e) => morphClick(e, navigate), { capture: true });
  window.addEventListener('fos-feedback', onFeedback);
  window.fosBack = predictiveBack;
}
