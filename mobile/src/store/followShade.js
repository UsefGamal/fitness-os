// A follow-along (warm-up, cool-down, stretches) in the notification shade:
// the move now, its countdown, and what comes next, through the same native
// countdown as the rest timer (RestTimerService), so it shows on the lock
// screen too. The app's clock stays in charge: FollowAlong sends each move
// as it starts, and the shade's buttons come back here as pause, resume,
// skip and ±15 s.
import { followShadeLines } from '../lib/followAlong.js';
import { trainingSettings } from '../lib/training.js';
import { recordError } from './errors.js';
import { isNative, RestTimer } from './native.js';
import { useData } from './useData.js';
import { setShadeOwner } from './useTimer.js';

// The shade's countdown ends a second after the move, so the app has moved
// it on to the next move first and the "Rest done" alert never fires
// between moves. If the app is asleep, that alert is the fallback.
const SLACK_MS = 1000;

const TEXTS = {
  next: '{label}', rest: 'Follow along', restTimer: 'Rest timer', paused: 'Paused', pause: 'Pause', resume: 'Resume',
  skip: 'Next', done: 'Time to move on', go: 'GO', openWorkout: 'Open app', moreRest: '+30s', nextSet: 'Open the app for the next move',
};

/** Show move `index` of `steps` with `leftMs` to go (paused or running). */
export async function followToShade({ steps, index, title, leftMs, totalS, paused = false }) {
  if (!isNative()) return;
  const lines = followShadeLines(steps, index, title);
  if (!lines) return;
  setShadeOwner('follow');
  try {
    const { sounds } = trainingSettings(useData.getState().data);
    await RestTimer.start({
      endsAt: Date.now() + Math.max(0, leftMs) + SLACK_MS,
      pausedLeft: paused ? Math.max(1000, leftMs) : 0,
      total: totalS, label: lines.label, workout: lines.progress, progress: lines.progress, detail: lines.detail,
      sets: 0, sound: sounds, texts: TEXTS,
    });
  } catch (err) {
    recordError(new Error(`Follow-along in notifications: ${err?.message || err}`));
  }
}

/** Take the follow-along out of the shade and give it back to the rest timer. */
export function followShadeOff() {
  if (!isNative()) return;
  setShadeOwner('rest');
  RestTimer.stop().catch(() => {});
}

/** Listen to the shade's buttons while following along. `on` gets
 * { paused, leftMs } after Pause, Resume or ±15 s, and { skipped: true }
 * after Next. Returns a function that stops listening. */
export function onFollowShade(on) {
  if (!isNative()) return () => {};
  const subs = [
    RestTimer.addListener('changed', ({ endsAt, pausedLeft }) => {
      const p = Number(pausedLeft) || 0;
      on(p > 0 ? { paused: true, leftMs: p - SLACK_MS } : { paused: false, leftMs: (Number(endsAt) || Date.now()) - Date.now() - SLACK_MS });
    }),
    RestTimer.addListener('stopped', ({ finished }) => {
      if (!finished) on({ skipped: true });
    }),
  ];
  return () => subs.forEach((s) => Promise.resolve(s).then((h) => h?.remove?.()).catch(() => {}));
}
