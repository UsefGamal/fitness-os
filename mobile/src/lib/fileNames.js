// File names for exports. Pure helpers, tested in fileNames.test.js.

/** 'training-week-2026-11-01.html' -> 'training-week-2026-11-01-0726.html'
 * (adds the time, and seconds too so two saves in a minute differ). */
export function alternateName(filename, now) {
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? `${filename.slice(0, dot)}-${stamp}${filename.slice(dot)}` : `${filename}-${stamp}`;
}
