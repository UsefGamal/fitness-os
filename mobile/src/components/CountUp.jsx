import { useEffect, useRef, useState } from 'react';

import { countAt } from '../lib/motion.js';

const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A number that counts from its last value to the new one (SA-05). Effort
 * and food-eaten numbers only: never weight, waist or body fat. With reduced
 * motion it just changes. */
export default function CountUp({ value, duration = 450 }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value || reduced() || typeof value !== 'number') {
      setShown(value);
      return undefined;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now) => {
      const n = countAt(start, value, now - t0, duration);
      setShown(n);
      if (n !== value) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="count-up">{shown}</span>;
}
