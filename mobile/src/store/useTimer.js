// The rest timer. On the phone the countdown also runs in the notification
// shade (RestTimerService), which buzzes when it's over and has +15s and
// Skip buttons; the shade and the app keep each other in step. Pausing
// takes the countdown out of the shade and keeps the time left here.
import { LocalNotifications } from '@capacitor/local-notifications';
import { create } from 'zustand';

import { trainingSettings } from '../lib/training.js';
import { feedback } from './feedback.js';
import { isNative, RestTimer } from './native.js';
import { useData } from './useData.js';

let asked = false;

async function toShade(endsAt, label) {
  if (!isNative()) return;
  try {
    if (!asked) {
      asked = true;
      await LocalNotifications.requestPermissions(); // Android 13+ needs it for any notification
    }
    const { sounds } = trainingSettings(useData.getState().data);
    await RestTimer.start({ endsAt, label, sound: sounds });
  } catch {
    // No notification permission: the in-app timer still works.
  }
}

export const useTimer = create((set, get) => ({
  endsAt: null,
  total: 0,
  label: '',
  pausedLeft: null, // ms left while paused, else null
  start(seconds, label) {
    if (!seconds) return;
    const endsAt = Date.now() + seconds * 1000;
    set({ endsAt, total: seconds, label, pausedLeft: null });
    feedback('restStart');
    toShade(endsAt, label);
  },
  add(seconds) {
    const { endsAt, label, pausedLeft } = get();
    if (pausedLeft != null) {
      set({ pausedLeft: Math.max(1000, pausedLeft + seconds * 1000) });
      return;
    }
    if (!endsAt) return;
    const next = Math.max(Date.now(), endsAt) + seconds * 1000;
    if (next <= Date.now()) {
      get().skip();
      return;
    }
    set({ endsAt: next });
    toShade(next, label);
  },
  pause() {
    const { endsAt } = get();
    if (!endsAt) return;
    set({ pausedLeft: Math.max(0, endsAt - Date.now()) });
    if (isNative()) RestTimer.stop().catch(() => {});
  },
  resume() {
    const { pausedLeft, label } = get();
    if (pausedLeft == null) return;
    const endsAt = Date.now() + pausedLeft;
    set({ endsAt, pausedLeft: null });
    toShade(endsAt, label);
  },
  /** End the rest early. */
  skip() {
    feedback('stop');
    get().stop();
  },
  stop() {
    set({ endsAt: null, pausedLeft: null });
    if (isNative()) RestTimer.stop().catch(() => {});
  },
  /** Pick up what the shade did while the app was in the background. */
  async sync() {
    if (!isNative()) return;
    try {
      const s = await RestTimer.state();
      if (get().pausedLeft != null) return; // paused here: the shade is empty on purpose
      if (s.endsAt > Date.now()) set({ endsAt: s.endsAt, label: s.label || get().label });
      else if (get().endsAt && get().endsAt > Date.now()) set({ endsAt: null });
    } catch {
      // Plugin missing in an old build: nothing to sync.
    }
  },
}));

if (isNative()) {
  RestTimer.addListener('changed', ({ endsAt, label }) => useTimer.setState({ endsAt, label }));
  RestTimer.addListener('stopped', () => {
    if (useTimer.getState().pausedLeft == null) useTimer.setState({ endsAt: null });
  });
}
