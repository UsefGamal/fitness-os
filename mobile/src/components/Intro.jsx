import { useEffect, useRef } from 'react';

import { t } from '../lib/i18n.js';
import { MARK } from '../lib/brand.js';
import { INTRO_MS, goldenLayout, slitDir } from '../lib/intro.js';
import { tap } from '../store/feedback.js';

// The leap (concept A), over Home.
//  full  (first open of the day, 1.9 s): the ط starts where Android's splash
//        left it, rises to the golden line while "Tafra." and the slogan come
//        in under it on a soft launch pad, crouches, launches along the slit
//        between its stem and tail and leaves the screen, then reappears in
//        Home's header beside the name with one haptic tick.
//  short (later opens, 0.8 s): the launch and the header landing only.
//  fade  (Reduce motion, 0.2 s): the still mark fades, nothing moves.
// A tap anywhere skips it. Only transform and opacity move (FEEL-1).

const SPLASH = 104;                     // the mark's size on Android's splash
const SPRING = 'cubic-bezier(.3, 1.35, .5, 1)';
const EMPH = 'cubic-bezier(.2, 0, 0, 1)';
const DIR = slitDir();
// The speed lines stream back from the slit's open end and the stem's top tip.
const TIPS = [[1.2 - 12, 20.88 - 12], [12.66 - 12, 4.62 - 12]];
const launchEase = (u) => u ** 1.7;

/** Where the mark lands: the header mark on Home, or the spot it would be. */
function landing() {
  const el = document.querySelector('.home-head .wordmark-mark');
  const r = el?.getBoundingClientRect();
  if (r && r.width > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width, el };
  return { x: 34, y: 38, size: 24, el: null };
}

export default function Intro({ kind = 'full', line, onDone }) {
  const coverRef = useRef(null);
  const markRef = useRef(null);
  const landRef = useRef(null);
  const padRef = useRef(null);
  const titleRef = useRef(null);
  const subRef = useRef(null);
  const t1Ref = useRef(null);
  const t2Ref = useRef(null);
  const done = useRef(false);

  useEffect(() => {
    const finish = () => { if (!done.current) { done.current = true; onDone(); } };
    const W = window.innerWidth, H = window.innerHeight;
    const c = { x: W / 2, y: H / 2 };
    const g = goldenLayout(H, SPLASH);
    const land = landing();
    const at = (x, y, s = 1, sx = 1, sy = 1) => `translate(${x - c.x}px, ${y - c.y}px) scale(${s * sx}, ${s * sy})`;
    const anims = [];
    const A = (el, frames, delay, duration, easing = 'linear', fill = 'both') => {
      if (!el) return;
      anims.push(el.animate(frames, { delay, duration, easing, fill }));
    };
    const timers = [];
    let raf = 0;
    const home = document.querySelector('.page.home');
    document.documentElement.classList.add('intro-on');

    const cover = coverRef.current, mark = markRef.current, pad = padRef.current, title = titleRef.current, sub = subRef.current;
    const landEl = landRef.current;
    if (landEl) Object.assign(landEl.style, { left: `${land.x - land.size / 2}px`, top: `${land.y - land.size / 2}px`, width: `${land.size}px`, height: `${land.size}px` });
    if (title) { title.style.fontSize = `${g.title}px`; title.style.top = `${g.titleTop}px`; }
    if (sub) { sub.style.fontSize = `${g.sub}px`; sub.style.top = `${g.subTop}px`; }
    if (pad) Object.assign(pad.style, { width: `${g.pad}px`, left: `${c.x - g.pad / 2}px`, top: `${g.padTop}px` });

    // The launch: a straight line along the slit, faster and faster, until
    // the mark is off the screen. The speed lines are drawn per frame.
    const launch = (from, s0, start, dur) => {
      const L = Math.min((W + 70 - from[0]) / DIR[0], (from[1] + 70) / -DIR[1]);
      const frames = [];
      for (let i = 0; i <= 12; i += 1) {
        const u = i / 12, d = launchEase(u) * L;
        frames.push({ transform: at(from[0] + DIR[0] * d, from[1] + DIR[1] * d, s0 + (1.04 - s0) * Math.min(1, u * 3)), offset: u });
      }
      A(mark, frames, start, dur, 'linear', 'forwards');
      const t0 = performance.now() + start;
      const draw = (now) => {
        const u = (now - t0) / dur;
        const lines = [t1Ref.current, t2Ref.current];
        if (u < 0) { raf = requestAnimationFrame(draw); return; }
        if (u > 1) { lines.forEach((p) => p && (p.style.opacity = 0)); return; }
        const d = launchEase(u) * L, k = (s0 + (1.04 - s0) * Math.min(1, u * 3)) * SPLASH / 24;
        const cx = from[0] + DIR[0] * d, cy = from[1] + DIR[1] * d, len = Math.min(d, 40 + 90 * u);
        const o = d > 6 ? Math.min(1, u * 5) * (1 - u) ** 0.8 : 0;
        lines.forEach((p, i) => {
          if (!p) return;
          const x0 = cx + TIPS[i][0] * k - DIR[0] * 3, y0 = cy + TIPS[i][1] * k - DIR[1] * 3;
          p.setAttribute('d', `M${(x0 - DIR[0] * len).toFixed(1)} ${(y0 - DIR[1] * len).toFixed(1)}L${x0.toFixed(1)} ${y0.toFixed(1)}`);
          p.style.opacity = String(i ? o * 0.8 : o);
        });
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    };
    // Home rises in under the cover, and the mark comes back in the header,
    // from just below-left of its spot (still travelling along the slit).
    const arrive = (coverAt, backAt, backMs) => {
      A(cover, [{ opacity: 1 }, { opacity: 0 }], coverAt, 340, EMPH);
      A(home, [{ transform: 'translateY(18px)', opacity: 0.6 }, { transform: 'none', opacity: 1 }], coverAt, 400, SPRING, 'none');
      A(landEl, [
        { opacity: 0, transform: `translate(${-DIR[0] * 22}px, ${-DIR[1] * 22}px) scale(.5)` },
        { opacity: 1, transform: 'scale(1.14)', offset: 0.55 },
        { opacity: 1, transform: 'none' },
      ], backAt, backMs, SPRING);
      timers.push(setTimeout(tap, backAt + backMs * 0.55));
    };

    if (kind === 'fade') {
      A(landEl, [{ opacity: 0 }, { opacity: 0 }], 0, 1);
      A(mark, [{ opacity: 1 }, { opacity: 0 }], 0, 200, 'ease-out');
      A(cover, [{ opacity: 1 }, { opacity: 0 }], 0, 200, 'ease-out');
      document.documentElement.classList.remove('intro-on');
    } else if (kind === 'short') {
      launch([c.x, c.y], 1, 0, 420);
      arrive(180, 480, 320);
    } else {
      const rest = at(c.x, g.markY), crouched = at(c.x, g.markY + 5, 0.92, 1.04, 0.92);
      A(mark, [{ transform: at(c.x, c.y) }, { transform: rest }], 0, 380, EMPH);
      A(mark, [{ transform: rest }, { transform: crouched }], 700, 300, 'cubic-bezier(.4,0,.2,1)', 'forwards');
      A(title, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], 140, 360, SPRING);
      A(sub, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], 280, 360, SPRING);
      A(title, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }], 1020, 240, 'ease-in', 'forwards');
      A(sub, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }], 1040, 240, 'ease-in', 'forwards');
      A(pad, [{ opacity: 0, transform: 'scaleX(.4)' }, { opacity: 1, transform: 'scaleX(1)' }], 240, 320, EMPH);
      A(pad, [{ opacity: 1, transform: 'scaleX(1)' }, { opacity: 1, transform: 'scaleX(1.3)' }], 700, 300, 'ease-out', 'forwards');
      A(pad, [{ opacity: 1, transform: 'scaleX(1.3)' }, { opacity: 0, transform: 'scaleX(.2)' }], 1000, 260, EMPH, 'forwards');
      launch([c.x, g.markY + 5], 0.92, 1000, 480);
      arrive(1300, 1520, 380);
    }
    timers.push(setTimeout(finish, INTRO_MS[kind] ?? INTRO_MS.full));

    // A reminder or widget tap opens its screen by changing the hash, often
    // just after the intro has started (the launch link arrives async). End
    // the intro then, so it never sits in front of the screen asked for.
    window.addEventListener('hashchange', finish);
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      anims.forEach((a) => a.cancel());
      window.removeEventListener('hashchange', finish);
      document.documentElement.classList.remove('intro-on');
    };
  // The intro plays once per mount; App remounts it for a new open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => { if (!done.current) { done.current = true; onDone(); } };
  return (
    <button type="button" className={`intro intro-${kind}`} onClick={skip} aria-label={`${t('intro.slogan')} ${line ? `${line}. ` : ''}Tap to skip the intro`}>
      <span className="intro-cover" ref={coverRef} aria-hidden="true" />
      {kind === 'full' ? (
        <>
          <span className="intro-pad" ref={padRef} aria-hidden="true" />
          <span className="intro-name" ref={titleRef} aria-hidden="true">{t('home.wordmark')}<span className="accent">{t('home.wordmarkOs')}</span></span>
          <span className="intro-slogan" ref={subRef} aria-hidden="true">{t('intro.slogan')}</span>
        </>
      ) : null}
      <svg className="intro-trails" aria-hidden="true"><path ref={t1Ref} /><path ref={t2Ref} /></svg>
      <svg className="intro-mark" ref={markRef} viewBox="0 0 24 24" aria-hidden="true"><path d={MARK} /></svg>
      <svg className="intro-land" ref={landRef} viewBox="0 0 24 24" aria-hidden="true"><path d={MARK} /></svg>
    </button>
  );
}
