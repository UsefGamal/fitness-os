import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { todayISO } from '../lib/dates.js';
import { t } from '../lib/i18n.js';
import { pushOverlay } from '../lib/overlays.js';
import { finishTour, placeTip, tourStops } from '../lib/tour.js';
import { tap } from '../store/feedback.js';
import { useData } from '../store/useData.js';

const PAD = 6; // light around the control

const present = () => [...document.querySelectorAll('[data-tour]')].map((el) => el.getAttribute('data-tour'));
const find = (name) => (name ? document.querySelector(`[data-tour="${name}"]`) : null);

/** The guided tour (ONB-3): the screen dims, a spotlight lands on one
 * control at a time with a tip card beside it. Next, a tap on the lit
 * control or on the dim goes on; Back goes back; Skip (or Android Back)
 * ends it. Runs on Home; which stops, and where the tip goes, is
 * lib/tour.js. */
export default function GuidedTour() {
  const update = useData((s) => s.update);
  const [stops, setStops] = useState(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [tipH, setTipH] = useState(200);
  const card = useRef(null);

  // Home first; the stops are what's on screen once it has drawn.
  useEffect(() => {
    if (window.location.hash && window.location.hash !== '#/') window.location.hash = '#/';
    const id = setTimeout(() => setStops(tourStops(present())), 450);
    return () => clearTimeout(id);
  }, []);

  const stop = stops?.[i];
  const end = (skipped) => { update((d) => finishTour(d, todayISO(), { skipped })); };
  useEffect(() => pushOverlay(() => end(true)), []);

  // Bring the control into view, then light it; follow it on resize.
  useLayoutEffect(() => {
    if (!stop) return undefined;
    const el = find(stop.target);
    if (!el) { setRect(null); return undefined; }
    if (!el.closest('.tabbar')) el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2, bottom: r.bottom + PAD });
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure); };
  }, [stop]);

  useLayoutEffect(() => {
    if (card.current) setTipH(card.current.offsetHeight);
    card.current?.focus({ preventScroll: true });
  }, [i, stops]);

  if (!stops || !stop) return null;
  const last = i === stops.length - 1;
  const next = () => { tap(); if (last) end(false); else setI(i + 1); };
  const back = () => { if (i > 0) setI(i - 1); };
  const lit = stop.target ? rect : null;
  const sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
  const place = placeTip(lit, { height: window.innerHeight, top: sat, bottom: 0 }, tipH);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* The dim, and a tap anywhere on it goes on. Hidden from TalkBack:
          the card's buttons do the same. */}
      <button type="button" className={`tour-dim${lit ? ' clear' : ''}`} tabIndex={-1} aria-hidden="true" onClick={next} />
      {lit ? (
        <button type="button" className="tour-spot" tabIndex={-1} aria-hidden="true" onClick={next}
          style={{ top: lit.top, left: lit.left, width: lit.width, height: lit.height }} />
      ) : null}
      <div ref={card} tabIndex={-1} className={`tour-card ${place.side}`} style={{ top: place.top }} key={stop.id}>
        <div className="tour-count">{t('tour.count', { n: i + 1, of: stops.length })}</div>
        <h2 id="tour-title" className="tour-title">{t(`tour.${stop.id}.title`)}</h2>
        <p className="tour-body">{t(`tour.${stop.id}.body`)}</p>
        <div className="tour-dots" aria-hidden="true">{stops.map((s, n) => <span key={s.id} className={n === i ? 'on' : ''} />)}</div>
        <div className="tour-actions">
          {last ? <span /> : <button type="button" className="btn ghost small tour-skip" onClick={() => end(true)}>{t('tour.skip')}</button>}
          <div className="row" style={{ gap: 8 }}>
            {i > 0 ? <button type="button" className="btn secondary small tour-btn" onClick={back}>{t('setup.back')}</button> : null}
            <button type="button" className="btn small tour-btn" onClick={next}>{last ? t('tour.done') : i === 0 ? t('tour.go') : t('setup.next')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
