// Photo lock state for this run of the app (P14-13). Kept in memory only:
// a cold start always starts locked. Rules in lib/photoLock.js.
import { LOCKED, photoLockStep, photosOpen } from '../lib/photoLock.js';
import { isNative, PhotoLock } from './native.js';

let state = { ...LOCKED };

export function photoLockEvent(event) {
  state = photoLockStep(state, event, Date.now());
  return state;
}

export function isPhotosOpen() {
  return photosOpen(state, Date.now());
}

/** Does this phone have a lock to ask for? null when unknown (a browser
 * or an older APK): then Photos opens as before. */
export async function phoneHasLock() {
  if (!isNative()) return null;
  try {
    return (await PhotoLock.available()).lock === true;
  } catch {
    return null;
  }
}

/** Ask for the phone's lock. true when Photos may open. */
export async function unlockPhotos(title, subtitle) {
  // The lock screen is the app's own trip, not leaving.
  photoLockEvent('external');
  try {
    const { unlocked } = await PhotoLock.unlock({ title, subtitle });
    if (unlocked) photoLockEvent('unlock');
    return Boolean(unlocked);
  } catch {
    return false;
  } finally {
    photoLockEvent('return');
  }
}

/** No screenshots or recent-apps preview while Photos is open. */
export async function securePhotos(on) {
  if (!isNative()) return;
  try {
    await PhotoLock.secure({ on });
  } catch {
    // An older APK: nothing to do.
  }
}
