import { useEffect } from 'react';

import { INTRO_MS } from '../lib/intro.js';

// The bolt from the launch screen (res/drawable/splash.png), so the intro
// picks up exactly where Android's splash leaves off.
const BOLT = 'M13 2 3 14h9l-1 8 10-12h-9z';

/**
 * A 1.8 s intro over Home: the splash bolt charges up, a ring closes around
 * it, the name and today's session rise in, then it all fades to Home (which
 * is already drawn underneath). A tap anywhere skips it.
 */
export default function Intro({ line, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, INTRO_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <button type="button" className="intro" onClick={onDone} aria-label="Skip intro">
      <svg className="intro-mark" viewBox="0 0 160 160" aria-hidden="true">
        <circle className="intro-ring-bg" cx="80" cy="80" r="70" />
        <circle className="intro-ring" cx="80" cy="80" r="70" />
        <g className="intro-bolt">
          <path d={BOLT} transform="translate(23 23) scale(4.75)" />
        </g>
      </svg>
      <span className="intro-text">
        <span className="intro-name">Fitness OS</span>
        {line ? <span className="intro-line">{line}</span> : null}
      </span>
    </button>
  );
}
