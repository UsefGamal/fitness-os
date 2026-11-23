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

/** Tafra's Google Play page (PLAY-1). Like RELEASES_URL, only opened on a tap. */
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.usefgamal.fitnessos';

// The only pages outside the app a fixed button may open.
const OUTSIDE = new Set([RELEASES_URL, PLAY_URL]);

/** The URL when it is exactly one of the app's own outside pages, else null. */
export function safeOutside(url) {
  return typeof url === 'string' && OUTSIDE.has(url) ? url : null;
}

/** What "Share Tafra" hands to the share sheet: one fixed sentence
 * and the download page. Nothing about the person. */
export const SHARE_APP_TEXT = `Tafra: a free training and meal plan app that keeps your data on your phone. Download: ${RELEASES_URL}`;

/** The Play Store's package name, as Android reports the installer. */
const PLAY_INSTALLER = 'com.android.vending';

/** True when Google Play installed this copy (store/native.js installer). */
export function fromPlay(installer) {
  return installer === PLAY_INSTALLER;
}

/** Where "Check for updates" goes (PLAY-1). Google Play doesn't allow an
 * app it installed to send people elsewhere for updates, so a Play copy
 * opens its Play page; an APK from GitHub opens the releases page. */
export function updateUrl(installer) {
  return fromPlay(installer) ? PLAY_URL : RELEASES_URL;
}

/** "Share Tafra" text: the same sentence, with the link to where this copy
 * came from, so a friend gets the same kind of install. */
export function shareAppText(installer) {
  return fromPlay(installer) ? SHARE_APP_TEXT.replace(RELEASES_URL, PLAY_URL) : SHARE_APP_TEXT;
}
