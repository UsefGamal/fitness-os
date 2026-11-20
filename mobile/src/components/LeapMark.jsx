import { MARK } from '../lib/brand.js';

/** The Tafra mark as a small inline sign (LF-8): beside a PR, on the goal
 * card. `draw` traces it as a line first, the way the intro does; Reduce
 * motion shows it filled at once (styles.css mirror). */
export default function LeapMark({ size = 20, draw = false, className = '' }) {
  return (
    <svg className={`leap-mark${draw ? ' draw' : ''}${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {draw ? <path className="leap-line" d={MARK} pathLength="100" /> : null}
      <path className="leap-fill" d={MARK} fillRule="evenodd" />
    </svg>
  );
}
