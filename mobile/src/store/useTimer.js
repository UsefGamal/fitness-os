// The rest timer. On the phone the countdown also runs in the notification
// shade (RestTimerService), which buzzes when it's over and has +15s and
// Skip buttons; the shade and the app keep each other in step. Pausing
// takes the countdown out of the shade and keeps the time left here.
import { LocalNotifications } from '@capacitor/local-notifications';
import { create } from 'zustand';

import { t } from '../lib/i18n.js';
import { trainingSettings } from '../lib/training.js';
import { feedback } from './feedback.js';
import { isNative, RestTimer } from './native.js';
import { useData } from './useData.js';

let asked = false;

// The longest rest the timer runs (pentest AND-03): a rest time from an
// imported plan can't keep the shade timer and its wakelock going for days.
export const MAX_REST_S = 30 * 60;

async function toShade(endsAt, label) {
  if (!isNative()) return;
  useTimer.setState({ inShade: false });
  try {
    if (!asked) {
      asked = true;
      await LocalNotifications.requestPermissions(); // Android 13+ needs it for any notification
    }
    const { sounds } = trainingSettings(useData.getState().data);
    const texts = {
      rest: t('shade.rest'), restTimer: t('shade.restTimer'), then: t('shade.then'), skip: t('shade.skip'),
      done: t('shade.done'), nextSet: t('shade.nextSet'), nextSetLabel: t('shade.nextSetLabel'),
    };
    await RestTimer.start({ endsAt, label, sound: sounds, texts });
    useTimer.setState({ inShade: true });
  } catch {
    // No notification permission: the in-app timer still works.
  }
}

export const useTimer = create((set, get) => ({
  endsAt: null,
  total: 0,
  label: '',
  pausedLeft: null, // ms left while paused, else null
  inShade: false, // the countdown also runs in the notification shade, which chimes at the end
  start(seconds, label) {
    if (!(seconds > 0)) return;
    seconds = Math.min(seconds, MAX_REST_S);
    const endsAt = Date.now() + seconds * 1000;
    set({ endsAt, total: seconds, label, pausedLeft: null });
    feedback('restStart');
    toShade(endsAt, label);
  },
  add(seconds) {
    const { endsAt, label, pausedLeft } = get();
    if (pausedLeft != null) {
      set({ pausedLeft: Math.min(Math.max(1000, pausedLeft + seconds * 1000), MAX_REST_S * 1000) });
      return;
    }
    if (!endsAt) return;
    const next = Math.min(Math.max(Date.now(), endsAt) + seconds * 1000, Date.now() + MAX_REST_S * 1000);
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
      // After a restart the app has no total, so the bar would sit empty
      // (QA-15): count the time left as the whole rest.
      if (s.endsAt > Date.now()) set({ endsAt: s.endsAt, label: s.label || get().label, ...(get().total ? {} : { total: Math.ceil((s.endsAt - Date.now()) / 1000) }) });
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
