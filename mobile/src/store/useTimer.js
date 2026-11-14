// The rest timer. On the phone the countdown also runs in the notification
// shade (RestTimerService) with the workout's name, the next exercise, a
// progress bar and Pause/Resume, +15s and Skip buttons; it buzzes when it's
// over. The shade and the app keep each other in step, both ways.
// The timer is also kept in localStorage (and natively in the service), so it
// comes back when the phone kills the app in the background (Xiaomi,
// Infinix...).
import { LocalNotifications } from '@capacitor/local-notifications';
import { create } from 'zustand';

import { t } from '../lib/i18n.js';
import { syncFromShade, timerToRestore, timerToSave } from '../lib/restTimer.js';
import { trainingSettings } from '../lib/training.js';
import { recordError } from './errors.js';
import { feedback } from './feedback.js';
import { isNative, RestTimer } from './native.js';
import { useData } from './useData.js';

let asked = false;
const KEY = 'fitness-os-rest-timer';

function saved() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function keep(state) {
  try {
    const s = timerToSave(state);
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // No storage (private window): the timer just isn't kept.
  }
}

// The longest rest the timer runs (pentest AND-03): a rest time from an
// imported plan can't keep the shade timer and its wakelock going for days.
export const MAX_REST_S = 30 * 60;

// Who has the shade's countdown: the rest timer, or a warm-up or stretch
// follow-along (store/followShade.js). While a follow-along has it, what the
// shade does belongs to that and never turns into a rest here.
let owner = 'rest';
export function setShadeOwner(who) {
  owner = who;
}
const restOwnsShade = () => owner === 'rest';

/** The workout under way, for the shade: its name and the sets done so far
 * (the name is kept in `notes`), used when the caller sent no lines. */
function currentWorkout() {
  const { data, activeWorkoutId } = useData.getState();
  const w = (data?.workouts || []).find((x) => x.id === activeWorkoutId && !x.finished_at);
  return w ? { workout: String(w.label || w.notes || '').slice(0, 80), sets: Array.isArray(w.sets) ? w.sets.length : 0 } : { workout: '', sets: 0 };
}

/** Put the app's timer, as it is now, in the shade (running or paused). */
async function toShade() {
  if (!isNative()) return;
  useTimer.setState({ inShade: false });
  try {
    if (!asked) {
      asked = true;
      await LocalNotifications.requestPermissions(); // Android 13+ needs it for any notification
    }
    // The permission dialog can take a while: send the timer as it is now.
    const { endsAt, pausedLeft, total, label, lines } = useTimer.getState();
    if (!endsAt && pausedLeft == null) return;
    const { sounds } = trainingSettings(useData.getState().data);
    const texts = {
      rest: t('shade.rest'), restTimer: t('shade.restTimer'), then: t('shade.then'), skip: t('shade.skip'),
      done: t('shade.done'), nextSet: t('shade.nextSet'), nextSetLabel: t('shade.nextSetLabel'),
      paused: t('shade.paused'), pause: t('shade.pause'), resume: t('shade.resume'), left: t('shade.left'), sets: t('shade.sets'),
      next: t('shade.next'), go: t('shade.go'), moreRest: t('shade.moreRest'), openWorkout: t('shade.openWorkout'),
    };
    const w = currentWorkout();
    await RestTimer.start({
      endsAt: endsAt || Date.now(), pausedLeft: pausedLeft || 0, total, label, ...w,
      detail: lines?.detail || '', progress: lines?.progress || w.workout, sound: sounds, texts,
    });
    useTimer.setState({ inShade: true });
  } catch (err) {
    // The plugin failed: the in-app timer still works, and the bug report
    // shows why (it failed silently before, so the shade never showed).
    recordError(new Error(`Rest timer in notifications: ${err?.message || err}`));
  }
  checkShade();
}

/** Is the countdown allowed in the shade? Off when the app's notifications
 * or the "Rest timer" channel are switched off, and then the timer says so. */
async function checkShade() {
  try {
    const s = await RestTimer.status();
    useTimer.setState({ shadeBlocked: s.enabled === false });
  } catch {
    // Older APK without status(): say nothing.
  }
}

export const useTimer = create((set, get) => ({
  endsAt: null,
  total: 0,
  label: '',
  lines: null, // { detail, progress } for the notification (lib/restTimer.js shadeLines)
  pausedLeft: null, // ms left while paused, else null
  inShade: false, // the countdown also runs in the notification shade, which chimes at the end
  shadeBlocked: false, // notifications are off, so the countdown can't show in the shade
  /** Start a rest before `label` (the next exercise); `lines` are the
   * notification's next-set and workout lines (shadeLines). */
  start(seconds, label, lines = null) {
    if (!(seconds > 0)) return;
    owner = 'rest';
    seconds = Math.min(seconds, MAX_REST_S);
    const endsAt = Date.now() + seconds * 1000;
    set({ endsAt, total: seconds, label, lines, pausedLeft: null });
    feedback('restStart');
    toShade();
  },
  add(seconds) {
    const { endsAt, pausedLeft } = get();
    if (pausedLeft != null) {
      set({ pausedLeft: Math.min(Math.max(1000, pausedLeft + seconds * 1000), MAX_REST_S * 1000) });
      toShade();
      return;
    }
    if (!endsAt) return;
    const next = Math.min(Math.max(Date.now(), endsAt) + seconds * 1000, Date.now() + MAX_REST_S * 1000);
    if (next <= Date.now()) {
      get().skip();
      return;
    }
    set({ endsAt: next });
    toShade();
  },
  /** Pause: the shade shows "Paused" with the time left and Resume. */
  pause() {
    const { endsAt } = get();
    if (!endsAt) return;
    set({ pausedLeft: Math.max(1000, endsAt - Date.now()) });
    toShade();
  },
  resume() {
    const { pausedLeft } = get();
    if (pausedLeft == null) return;
    set({ endsAt: Date.now() + pausedLeft, pausedLeft: null });
    toShade();
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
    if (!isNative() || !restOwnsShade()) return;
    let shade;
    try {
      shade = await RestTimer.state();
    } catch {
      return; // Plugin missing in an old build: nothing to sync.
    }
    const { patch, reshade } = syncFromShade(get(), shade);
    if (patch) set(patch);
    if (reshade) toShade();
    else if (get().endsAt) checkShade();
  },
  /** Open Android's notification settings for the rest timer. */
  async allowShade() {
    try {
      await RestTimer.openSettings();
    } catch {
      // Older APK: nothing to open.
    }
  },
}));

if (isNative()) {
  // Pause, Resume and +15s in the shade.
  RestTimer.addListener('changed', ({ endsAt, pausedLeft, label }) => {
    if (!restOwnsShade()) return;
    const paused = Number(pausedLeft) > 0;
    useTimer.setState({ endsAt: endsAt || Date.now(), pausedLeft: paused ? Number(pausedLeft) : null, label });
  });
  // Skip in the shade ends it here too; at the end the app shows "Rest done".
  RestTimer.addListener('stopped', ({ finished }) => {
    if (!restOwnsShade()) return;
    if (!finished) useTimer.setState({ endsAt: null, pausedLeft: null });
  });
}

// Keep the timer across the app being closed, and bring it back on start.
// On the phone, sync() at start (phoneSync) then takes the shade's timer if it
// is still on, or puts this one back in the shade.
const back = timerToRestore(saved());
if (back) useTimer.setState({ ...back, endsAt: back.endsAt && Math.min(back.endsAt, Date.now() + MAX_REST_S * 1000) });
useTimer.subscribe((s, prev) => {
  if (s.endsAt !== prev.endsAt || s.pausedLeft !== prev.pausedLeft || s.label !== prev.label || s.total !== prev.total) keep(s);
});
