import { useEffect, useRef } from 'react';

import { holdDelay, stepValue } from '../lib/hold.js';
import { tap } from '../store/feedback.js';
import Icon from './Icon.jsx';

/** Big +/- buttons so a set can be logged one-handed without the keyboard.
 * Holding a button keeps stepping, faster after a while (E4-S10). */
export default function Stepper({ value, onChange, step = 1, min = 0, max = 1000, label, decimals = 0 }) {
  // The latest value, for repeats that fire between renders.
  const latest = useRef(value);
  useEffect(() => { latest.current = value; }, [value]);
  const timer = useRef(null);
  const held = useRef(false);

  const set = (v) => {
    const n = stepValue(v, 0, { min, max, decimals });
    if (n !== latest.current) tap();
    latest.current = n;
    onChange(n);
  };
  const stop = () => { clearTimeout(timer.current); timer.current = null; };
  useEffect(() => stop, []);

  const start = (delta) => {
    stop();
    held.current = false;
    let n = 0;
    const again = () => {
      held.current = true;
      const before = latest.current;
      set(before + delta);
      // At the end of the range there is nothing left to repeat.
      if (latest.current === before) { stop(); return; }
      n += 1;
      timer.current = setTimeout(again, holdDelay(n));
    };
    timer.current = setTimeout(again, holdDelay(0));
  };
  // A tap is one step; after a hold the click that follows is not another.
  const click = (delta) => {
    stop();
    if (held.current) { held.current = false; return; }
    set(latest.current + delta);
  };
  const down = (e, delta) => { if (e.button === 0 || e.pointerType !== 'mouse') start(delta); };
  const noMenu = (e) => e.preventDefault();

  return (
    <label className="field">
      <span>{label}</span>
      <div className="stepper">
        <button type="button" aria-label={`Less ${label}`} onPointerDown={(e) => down(e, -step)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={noMenu} onClick={() => click(-step)}>
          <Icon name="minus" />
        </button>
        <input type="number" inputMode="decimal" value={value} onChange={(e) => set(parseFloat(e.target.value))} onFocus={(e) => e.target.select()} />
        <button type="button" aria-label={`More ${label}`} onPointerDown={(e) => down(e, step)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={noMenu} onClick={() => click(step)}>
          <Icon name="plus" />
        </button>
      </div>
    </label>
  );
}
