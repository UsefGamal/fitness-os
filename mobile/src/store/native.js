// The app's own Android plugins (mobile/android/.../timer, widget, health).
// In a browser (npm run dev) none of them exist, so every call is a no-op.
import { Capacitor, registerPlugin } from '@capacitor/core';

export const isNative = () => Capacitor.getPlatform() === 'android';

export const RestTimer = registerPlugin('RestTimer');
export const Widget = registerPlugin('Widget');
export const Health = registerPlugin('Health');
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
