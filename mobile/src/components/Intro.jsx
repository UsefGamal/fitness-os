import { useEffect } from 'react';

import { t } from '../lib/i18n.js';
import { MARK } from '../lib/brand.js';
import { INTRO_MS } from '../lib/intro.js';


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
