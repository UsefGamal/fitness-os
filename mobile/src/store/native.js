// The app's own Android plugins (mobile/android/.../timer, widget, health).
// In a browser (npm run dev) none of them exist, so every call is a no-op.
import { Capacitor, registerPlugin } from '@capacitor/core';

export const isNative = () => Capacitor.getPlatform() === 'android';

export const RestTimer = registerPlugin('RestTimer');
export const Widget = registerPlugin('Widget');
export const Health = registerPlugin('Health');
