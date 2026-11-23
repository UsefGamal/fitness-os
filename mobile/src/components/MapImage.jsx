import { useLayoutEffect, useRef, useState } from 'react';

import BodyMap from './BodyMap.jsx';

// A small body map drawn once as an SVG, then kept as an <img> (design laws
// #13). The workout list can hold a dozen of these: as live SVG their
// hundreds of paths made every logged set re-style the page (device test
// set-log, 50 ms budget at 6x CPU); as images they cost nothing after the
// first paint. Pictures are cached per muscles + theme for the session.
const CACHE = new Map();

const themeKey = () => (typeof document === 'undefined' ? '' : document.documentElement.dataset.theme || '');

/** The SVG as a standalone picture: classes and CSS variables written out,
 * since an image can't see the page's styles. */
export function svgPicture(svg, readVar) {
  const copy = svg.cloneNode(true);
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.removeAttribute('style');
  copy.removeAttribute('role');
  copy.removeAttribute('aria-label');
  for (const p of copy.querySelectorAll('.body-under path')) {
    p.setAttribute('fill', 'var(--body-skin)');
    p.setAttribute('stroke', 'var(--body-skin)');
    p.setAttribute('stroke-width', '3.4');
    p.setAttribute('stroke-linejoin', 'round');
  }
  for (const p of copy.querySelectorAll('.body-detail path')) {
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'var(--body-line)');
    p.setAttribute('stroke-width', '0.45');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('opacity', '0.55');
  }
  for (const el of copy.querySelectorAll('[class], [style]')) { el.removeAttribute('class'); el.removeAttribute('style'); }
  for (const el of copy.querySelectorAll('title')) el.remove();
  const text = copy.outerHTML.replace(/var\((--[\w-]+)\)/g, (m, name) => readVar(name) || m);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
}

export default function MapImage({ target, size = 48 }) {
  const key = `${themeKey()}|${(target.main || []).join(',')}|${(target.helpers || []).join(',')}|${target.angle || ''}`;
  const [src, setSrc] = useState(() => CACHE.get(key) || null);
  const box = useRef(null);
  useLayoutEffect(() => {
    if (src && CACHE.get(key) === src) return;
    const hit = CACHE.get(key);
    if (hit) { setSrc(hit); return; }
    const svg = box.current?.querySelector('svg');
    if (!svg) return;
    const css = getComputedStyle(document.documentElement);
    const url = svgPicture(svg, (name) => css.getPropertyValue(name).trim());
    CACHE.set(key, url);
    setSrc(url);
  }, [key, src]);
  if (src && CACHE.get(key) === src) return <img src={src} alt="" width={size} height={size} decoding="async" />;
  return <span ref={box} style={{ display: 'block', width: size }}><BodyMap bare zoom primary={target.main} secondary={target.helpers} focus={target.angle} size={size} /></span>;
}
