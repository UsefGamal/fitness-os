import { useEffect } from 'react';

import { t } from '../lib/i18n.js';
import { INTRO_MS } from '../lib/intro.js';

// The Tafra mark (a leaping ط) from the launch screen and launcher icon
// (res/drawable/ic_launcher_foreground.xml), so the intro picks up exactly
// where Android's splash leaves off. Its counter is a hole: fill even-odd.
const MARK = 'M11.72 6.06L15.55 4.55L13.79 10.98L16.97 9.56C20.1 8.99 22.6 10.81 22.83 14.02C23 16.15 21.86 17.68 19.82 17.8L7.54 17.8L1 19.5L6.46 14.87L9.02 14.87ZM12.14 14.9L19.19 14.9C19.39 13.59 18.82 12.45 17.83 12.26L16.92 12.31C15.27 13.02 13.56 14.02 12.14 14.9Z';

/**
 * A 1.8 s intro over Home (MOVE-1): the splash mark is drawn as a line, then
 * fills green with a glow, the ring springs closed around it, the name's
 * letters rise one by one and today's session follows. Then the whole intro
 * shrinks into the mark like a closing iris, showing Home (already drawn
 * underneath). A tap anywhere skips it.
 */
export default function Intro({ line, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, INTRO_MS);
    // A reminder or widget tap opens its screen by changing the hash, often
    // just after the intro has started (the launch link arrives async). End
    // the intro then, so it never sits in front of the screen asked for.
    window.addEventListener('hashchange', onDone);
    return () => {
      clearTimeout(id);
      window.removeEventListener('hashchange', onDone);
    };
  }, [onDone]);

  return (
    <button type="button" className="intro" onClick={onDone} aria-label={line ? `${line}. Tap to skip the intro` : 'Tap to skip the intro'}>
      <span className="intro-glow" aria-hidden="true" />
      <svg className="intro-mark" viewBox="0 0 160 160" aria-hidden="true">
        <circle className="intro-ring-bg" cx="80" cy="80" r="70" />
        <circle className="intro-ring" cx="80" cy="80" r="70" />
        <g className="intro-bolt" transform="translate(23 23) scale(4.75)">
          <path className="intro-bolt-line" d={MARK} pathLength="100" />
          <path className="intro-bolt-fill" d={MARK} fillRule="evenodd" />
        </g>
      </svg>
      <span className="intro-text">
        <span className="intro-name" aria-hidden="true">
          {[...t('home.wordmark')].map((ch, i) => <span key={`a${i}`} className="intro-ch" style={{ '--c': i }}>{ch === ' ' ? '\u00a0' : ch}</span>)}
          {[...t('home.wordmarkOs')].map((ch, i) => <span key={`b${i}`} className="intro-ch accent" style={{ '--c': i + t('home.wordmark').length }}>{ch}</span>)}
        </span>
        {line ? <span className="intro-line">{line}</span> : null}
      </span>
    </button>
  );
}
