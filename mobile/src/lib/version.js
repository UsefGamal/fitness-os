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
