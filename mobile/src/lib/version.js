// The app's version, baked in at build time by vite.config.js from the
// same values Gradle uses (APK_VERSION_NAME / APK_VERSION_CODE), so About
// and bug reports name the exact APK. In tests and dev they are "dev".
/* global __APP_VERSION__, __APP_BUILD__, __RELEASE__, __FLAVOR__ */
export const APP = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
  build: typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev',
  release: typeof __RELEASE__ !== 'undefined' ? __RELEASE__ : false,
  flavor: typeof __FLAVOR__ !== 'undefined' ? __FLAVOR__ : 'dev',
};

/** The signing code from a certificate SHA-256 in any form ("ab:cd:..."):
 * its first 8 hex digits as "ABCD-EF01". scripts/release-notes.sh prints
 * the same. null when it isn't a SHA-256. P14-08. */
export function codeOf(sha256) {
  const hex = String(sha256 || '').replace(/[:\s]/g, '').toUpperCase();
  return /^[0-9A-F]{64}$/.test(hex) ? `${hex.slice(0, 4)}-${hex.slice(4, 8)}` : null;
}
