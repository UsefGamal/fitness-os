import { useEffect, useRef } from 'react';

import { tap } from '../store/feedback.js';

const ROW = 52; // px per row; five rows show

/** An up-and-down wheel (age). The middle row is the pick; every row is
 * also a button, so a tap picks it and TalkBack reads each one. */
export default function WheelPicker({ value, onChange, options, unit, label }) {
  const box = useRef(null);
  const busy = useRef(false);
  const last = useRef(value);
  const index = Math.max(0, options.indexOf(value));

  useEffect(() => {
    const el = box.current;
    if (!el || busy.current) return;
    el.scrollTop = index * ROW;
  }, [index]);

  useEffect(() => { last.current = value; }, [value]);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    let raf = 0;
    let idle = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
        if (options[i] !== last.current) { last.current = options[i]; tap(); onChange(options[i]); }
      });
      clearTimeout(idle);
      busy.current = true;
      idle = setTimeout(() => { busy.current = false; }, 160);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); clearTimeout(idle); };
  }, [options]);

  const pick = (v) => () => {
    last.current = v;
    onChange(v);
    box.current?.scrollTo({ top: options.indexOf(v) * ROW, behavior: 'smooth' });
  };

  return (
    <div className="wheel" role="group" aria-label={label}>
      <div className="wheel-band" aria-hidden="true" />
      <div className="wheel-scroll" ref={box}>
        {options.map((o) => (
          <button key={o} type="button" className={`wheel-row${o === value ? ' on' : ''}`} aria-pressed={o === value} onClick={pick(o)}>
            <span className="wheel-n">{o}</span>{o === value ? <span className="wheel-unit">{unit}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
