// The app's own Android plugins (mobile/android/.../timer, widget, health).
// In a browser (npm run dev) none of them exist, so every call is a no-op.
import { Capacitor, registerPlugin } from '@capacitor/core';

import { codeOf } from '../lib/version.js';

export const isNative = () => Capacitor.getPlatform() === 'android';

export const RestTimer = registerPlugin('RestTimer');
export const Widget = registerPlugin('Widget');
export const Health = registerPlugin('Health');
export const AppInfo = registerPlugin('AppInfo');

/** The 8-character signing code About shows ("AB12-CD34"), or null in a
 * browser or an older APK. P14-08. */
export async function signingCode() {
  if (!isNative()) return null;
  try {
    return codeOf((await AppInfo.signing()).sha256);
  } catch {
    return null;
  }
}

export const Crash = registerPlugin('Crash');

/** Native crash lines saved since the last start ([{ at, message }]), and
 * clears them. Empty in a browser or an older APK. P14-15. */
export async function takeNativeCrashes() {
  if (!isNative()) return [];
  try {
    const out = await Crash.take();
    return Array.isArray(out?.crashes) ? out.crashes : [];
  } catch {
    return [];
  }
}

export const Device = registerPlugin('Device');

/** true/false: does the phone have a screen lock? null when unknown (a
 * browser, or an older APK without the plugin). P14-09. */
export async function hasScreenLock() {
  if (!isNative()) return null;
  try {
    return (await Device.security()).screenLock === true;
  } catch {
    return null;
  }
}
