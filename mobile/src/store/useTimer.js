// The rest timer. On the phone the countdown also runs in the notification
// shade (RestTimerService), which buzzes when it's over and has +15s and
// Stop buttons; the shade and the app keep each other in step.
import { LocalNotifications } from '@capacitor/local-notifications';
import { create } from 'zustand';

import { isNative, RestTimer } from './native.js';

let asked = false;

async function toShade(endsAt, label) {
  if (!isNative()) return;
  try {
    if (!asked) {
      asked = true;
      await LocalNotifications.requestPermissions(); // Android 13+ needs it for any notification
    }
    await RestTimer.start({ endsAt, label });
  } catch {
    // No notification permission: the in-app timer still works.
  }
}

export const useTimer = create((set, get) => ({
  endsAt: null,
  total: 0,
  label: '',
  start(seconds, label) {
    if (!seconds) return;
    const endsAt = Date.now() + seconds * 1000;
    set({ endsAt, total: seconds, label });
    toShade(endsAt, label);
  },
  add(seconds) {
    const { endsAt, label } = get();
    if (!endsAt) return;
    const next = Math.max(Date.now(), endsAt) + seconds * 1000;
    set({ endsAt: next });
    toShade(next, label);
  },
  stop() {
    set({ endsAt: null });
    if (isNative()) RestTimer.stop().catch(() => {});
  },
  /** Pick up what the shade did while the app was in the background. */
  async sync() {
    if (!isNative()) return;
    try {
      const s = await RestTimer.state();
      if (s.endsAt > Date.now()) set({ endsAt: s.endsAt, label: s.label || get().label });
      else if (get().endsAt && get().endsAt > Date.now()) set({ endsAt: null });
    } catch {
      // Plugin missing in an old build: nothing to sync.
    }
  },
}));

if (isNative()) {
  RestTimer.addListener('changed', ({ endsAt, label }) => useTimer.setState({ endsAt, label }));
  RestTimer.addListener('stopped', () => useTimer.setState({ endsAt: null }));
}
