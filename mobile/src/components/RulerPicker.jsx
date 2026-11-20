import { useEffect, useRef, useState } from 'react';

import { snap } from '../lib/setupSteps.js';
import { t } from '../lib/i18n.js';
import { tap } from '../store/feedback.js';
import Icon from './Icon.jsx';

const TICK = 12; // px between two small ticks

/** A ruler you drag sideways (height, weight), with the value big above it.
 * The big number is a real input, so it can also be typed, and -/+ step by
 * `nudge` for TalkBack and one-handed use. Left to right in both
 * directions, like a tape measure. */
export default function RulerPicker({ value, onChange, min, max, step = 1, major = 10, nudge = step, unit, label, decimals = 0 }) {
  const box = useRef(null);
  const busy = useRef(false); // the person is dragging: don't scroll under them
  const last = useRef(value);
  const ours = useRef(null); // where we scrolled it ourselves, so that scroll isn't read as a drag
  const count = Math.round((max - min) / step);
  const width = count * TICK;
  const toX = (v) => Math.round(((v - min) / step) * TICK);

  useEffect(() => {
    const el = box.current;
    if (!el || busy.current) return;
    ours.current = toX(value);
    el.scrollLeft = ours.current;
  }, [value]);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    let raf = 0;
    let idle = 0;
    const onScroll = () => {
      if (ours.current != null && Math.abs(el.scrollLeft - ours.current) < 2) return;
      ours.current = null;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const v = snap(min + (el.scrollLeft / TICK) * step, { min, max, step });
        if (v !== last.current) {
          last.current = v;
          if (Math.round((v - min) / step) % Math.round(major / step) === 0) tap();
          onChange(v);
        }
      });
      clearTimeout(idle);
      busy.current = true;
      idle = setTimeout(() => { busy.current = false; ours.current = toX(last.current); el.scrollTo({ left: ours.current, behavior: 'smooth' }); }, 140);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); clearTimeout(idle); };
  }, [min, max, step, major]);

  useEffect(() => { last.current = value; }, [value]);

  const set = (v) => { const n = snap(v, { min, max, step }); last.current = n; onChange(n); };
  // While typing, the field shows what is typed (80 goes through 8 first,
  // which is out of range); a value in range moves the ruler at once.
  const [draft, setDraft] = useState(null);
  const typed = (e) => {
    setDraft(e.target.value);
    const n = Number(e.target.value);
    if (e.target.value !== '' && Number.isFinite(n) && n >= min && n <= max) set(n);
  };
  const focus = (e) => { setDraft(e.target.value); e.target.select(); };
  const blur = () => { setDraft(null); };
  const less = () => { set(value - nudge); };
  const more = () => { set(value + nudge); };

  const labels = [];
  const every = Math.round(major / step);
  for (let i = 0; i <= count; i += every) labels.push(<span key={i} className="ruler-num" style={{ left: i * TICK }}>{Math.round(min + i * step)}</span>);

  return (
    <div className="ruler-picker">
      <div className="ruler-value">
        <button type="button" className="ruler-nudge" aria-label={t('aria.less', { label })} onClick={less}><Icon name="minus" /></button>
        <label className="ruler-read">
          <input type="number" inputMode="decimal" aria-label={label} min={min} max={max} step={step} value={draft ?? Number(value).toFixed(decimals)} onChange={typed} onFocus={focus} onBlur={blur} />
          <span className="ruler-unit">{unit}</span>
        </label>
        <button type="button" className="ruler-nudge" aria-label={t('aria.more', { label })} onClick={more}><Icon name="plus" /></button>
      </div>
      <div className="ruler" aria-hidden="true">
        <div className="ruler-scroll" ref={box} dir="ltr">
          <div className="ruler-track" style={{ width: width + 2, '--tick': `${TICK}px`, '--major': `${TICK * every}px`, '--half': `${(TICK * every) / 2}px` }}>
            {labels}
          </div>
        </div>
        <span className="ruler-needle" />
      </div>
    </div>
  );
}
