// Keep the screen on while a workout or interval session runs. On the phone
// this is the keep-awake plugin; in a browser, the Screen Wake Lock API.
import { KeepAwake } from '@capacitor-community/keep-awake';
import { useEffect, useRef, useState } from 'react';

import { shouldStayAwake } from '../lib/training.js';
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

/** While `active` is true the screen stays on. Several screens can ask at
 * once. With `idle` (a workout), the screen may sleep again after 20
 * minutes without a tap or a running rest timer, and any tap takes the
 * lock back (lib/training.js shouldStayAwake). */
export function useKeepAwake(active, { idle = false, restRunning = false } = {}) {
  const [awake, setAwake] = useState(true);
  const last = useRef(0);
  useEffect(() => {
    if (!active || !idle) return undefined;
    if (!last.current) last.current = Date.now();
    const check = () => setAwake(shouldStayAwake(last.current, restRunning, Date.now()));
    const touch = () => { last.current = Date.now(); setAwake(true); };
    const timer = setInterval(check, 60000);
    document.addEventListener('pointerdown', touch, true);
    document.addEventListener('keydown', touch, true);
    return () => {
      clearInterval(timer);
      document.removeEventListener('pointerdown', touch, true);
      document.removeEventListener('keydown', touch, true);
    };
  }, [active, idle, restRunning]);
  const hold = active && (!idle || awake || restRunning);
  useEffect(() => {
    if (!hold) return undefined;
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
  }, [hold]);
}
