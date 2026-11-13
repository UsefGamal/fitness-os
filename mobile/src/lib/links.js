// Links the app opens for the person. Exercise "Form video" links can come
// from an imported backup (a plan override is a full exercise list), so only
// https links to the video sites the plan content uses are ever shown: a
// crafted file can't open a look-alike page, a data: page inside the app,
// or another app's scheme.

const VIDEO_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'instagram.com', 'www.instagram.com']);

/** The URL when it is an https link to a known video site, else null. */
export function safeVideo(url) {
  if (typeof url !== 'string' || url.length > 500) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  return VIDEO_HOSTS.has(u.hostname) ? u.href : null;
}

/** Where every release is published. The app never fetches this itself
 * (UPD-1: no network call); the phone's browser opens it on a tap. */
export const RELEASES_URL = 'https://github.com/UsefGamal/fitness-os/releases/latest';

// The only pages outside the app a fixed button may open.
const OUTSIDE = new Set([RELEASES_URL]);

/** The URL when it is exactly one of the app's own outside pages, else null. */
export function safeOutside(url) {
  return typeof url === 'string' && OUTSIDE.has(url) ? url : null;
}

/** What "Share Fitness OS" hands to the share sheet: one fixed sentence
 * and the download page. Nothing about the person. */
export const SHARE_APP_TEXT = `Fitness OS: a free training and meal plan app that keeps your data on your phone. Download: ${RELEASES_URL}`;
