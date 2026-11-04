// Keep the screen on while a workout or interval session runs. On the phone
// this is the keep-awake plugin; in a browser, the Screen Wake Lock API.
import { KeepAwake } from '@capacitor-community/keep-awake';
import { useEffect } from 'react';

import { isNative } from './native.js';

let holders = 0;
let lock = null;

async function on() {
  try {
    if (isNative()) await KeepAwake.keepAwake();
    else if (navigator.wakeLock) lock = await navigator.wakeLock.request('screen');
  } catch {
    // Not allowed (battery saver, old WebView): the screen just sleeps as usual.
  }
}

async function off() {
  try {
    if (isNative()) await KeepAwake.allowSleep();
    else if (lock) await lock.release();
  } catch {
    // Already released.
  }
  lock = null;
}

/** While `active` is true the screen stays on. Several screens can ask at once. */
export function useKeepAwake(active) {
  useEffect(() => {
    if (!active) return undefined;
    holders += 1;
    if (holders === 1) on();
    // A browser drops the wake lock when the tab is hidden; take it again on return.
    const again = () => { if (document.visibilityState === 'visible' && holders > 0 && !isNative()) on(); };
    document.addEventListener('visibilitychange', again);
    return () => {
      document.removeEventListener('visibilitychange', again);
      holders -= 1;
      if (holders === 0) off();
    };
  }, [active]);
}
