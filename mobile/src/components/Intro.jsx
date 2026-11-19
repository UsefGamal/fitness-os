import { useEffect } from 'react';

import { t } from '../lib/i18n.js';
import { INTRO_MS } from '../lib/intro.js';

// The Tafra mark (a leaping ط) from the launch screen and launcher icon
// (res/drawable/ic_launcher_foreground.xml), so the intro picks up exactly
// where Android's splash leaves off. Its counter is a hole: fill even-odd.
const MARK = 'M14.71 4.62L17.69 3.28L14.32 12.04L18.06 10.48C20.87 9.78 22.97 11.24 22.97 14.07C22.99 15.95 21.89 17.38 20.07 17.6L9.19 18.36L1.02 21.24L8.98 16.67L10.34 16.58ZM12.76 16.41L20.57 15.86C20.93 14.21 20.43 12.37 18.95 12.12L18.19 12.22C16.11 13.29 14.22 15.31 12.76 16.41Z';

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
    <button type="button" className="intro" onClick={onDone} aria-label={`${t('intro.slogan')} ${line ? `${line}. ` : ''}Tap to skip the intro`}>
      <span className="intro-glow" aria-hidden="true" />
      <svg className="intro-mark" viewBox="0 0 160 160" aria-hidden="true">
        <circle className="intro-ring-bg" cx="80" cy="80" r="70" />
        <circle className="intro-ring" cx="80" cy="80" r="70" />
        <g className="intro-bolt" transform="translate(27.2 27.2) scale(4.4)">
          <path className="intro-bolt-line" d={MARK} pathLength="100" />
          <path className="intro-bolt-fill" d={MARK} fillRule="evenodd" />
        </g>
      </svg>
      <span className="intro-text">
        <span className="intro-name" aria-hidden="true">
          {[...t('home.wordmark')].map((ch, i) => <span key={`a${i}`} className="intro-ch" style={{ '--c': i }}>{ch === ' ' ? '\u00a0' : ch}</span>)}
          {[...t('home.wordmarkOs')].map((ch, i) => <span key={`b${i}`} className="intro-ch accent" style={{ '--c': i + t('home.wordmark').length }}>{ch}</span>)}
        </span>
        <span className="intro-slogan">{t('intro.slogan')}</span>
        {line ? <span className="intro-line">{line}</span> : null}
      </span>
    </button>
  );
}
