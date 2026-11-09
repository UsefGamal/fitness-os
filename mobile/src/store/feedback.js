// Sounds and haptics for workout moments, in one place:
//   feedback('restStart' | 'countdown' | 'restDone' | 'stop' | 'workoutStart'
//            | 'workoutSaved' | 'pr' | 'work' | 'rest' | 'test')
// Sounds are synthesised (no audio files to license or bundle) and follow
// Settings → Training. On the phone they are played natively (TonePlayer via
// the RestTimer plugin): the WebView's Web Audio stays muted until a tap and
// after the app comes back from the background. The "rest done" chime on the
// phone comes from RestTimerService when the shade timer runs, so it plays
// with the screen off too; the app only plays it when the shade isn't used.
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

import { restQuiet } from '../lib/motion.js';
import { trainingSettings, VOLUMES } from '../lib/training.js';
import { isNative, RestTimer } from './native.js';
import { useData } from './useData.js';
import { useTimer } from './useTimer.js';

// Notes as [frequency Hz, start s, length s].
const SOUNDS = {
  restStart: [[1320, 0, 0.05]],
  countdown: [[880, 0, 0.12]],
  restDone: [[660, 0, 0.35], [990, 0.18, 0.5]],
  stop: [[420, 0, 0.04]],
  workoutStart: [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.25]],
  workoutSaved: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.4]],
  pr: [[784, 0, 0.1], [988, 0.08, 0.1], [1175, 0.16, 0.1], [1568, 0.24, 0.45]],
  work: [[1046, 0, 0.3]],
  rest: [[523, 0, 0.25]],
  test: [[660, 0, 0.35], [990, 0.18, 0.5]],
};

// Browser fallback patterns (ms) when there is no native haptics engine.
const VIBRATION = {
  restDone: [200, 100, 200],
  workoutSaved: [60, 60, 120],
  pr: [80, 60, 80, 60, 160],
  work: [120],
  rest: [60],
  restStart: [20],
  tap: [8],
};

// The phone's haptics engine: short, crisp taps instead of a motor buzz.
const HAPTIC = {
  tap: () => Haptics.impact({ style: ImpactStyle.Light }),
  restStart: () => Haptics.impact({ style: ImpactStyle.Medium }),
  stop: () => Haptics.impact({ style: ImpactStyle.Light }),
  work: () => Haptics.impact({ style: ImpactStyle.Heavy }),
  rest: () => Haptics.impact({ style: ImpactStyle.Light }),
  workoutStart: () => Haptics.impact({ style: ImpactStyle.Medium }),
  workoutSaved: () => Haptics.notification({ type: NotificationType.Success }),
  pr: async () => {
    await Haptics.impact({ style: ImpactStyle.Heavy });
    setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}), 140);
  },
};

function buzz(event) {
  if (isNative()) {
    if (HAPTIC[event]) Promise.resolve(HAPTIC[event]()).catch(() => {});
  } else if (VIBRATION[event] && globalThis.navigator?.vibrate) {
    navigator.vibrate(VIBRATION[event]);
  }
}

let ctx = null;

function audio() {
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function play(notes, { volume, soft }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.01;
  for (const [freq, start, len] of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = soft ? 'sine' : 'triangle';
    osc.frequency.value = soft ? freq * 0.75 : freq;
    const peak = volume * (soft ? 0.5 : 0.7);
    gain.gain.setValueAtTime(0.0001, t0 + start);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + len);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + len + 0.05);
  }
}

function sound(notes, opts) {
  if (isNative()) {
    RestTimer.tone({ notes, ...opts }).catch(() => {
      // An older APK without the native player: try the WebView.
      try { play(notes, opts); } catch { /* stay silent */ }
    });
    return;
  }
  try {
    play(notes, opts);
  } catch {
    // No audio on this device: stay silent.
  }
}

/** Play the sound (and buzz) for a workout moment, if switched on.
 * `inShade`: the rest timer runs in the phone's shade, which chimes itself. */
export function feedback(event, { force = false, inShade = false } = {}) {
  // SA-06: in the last 3 s of a rest only the timer speaks; anything else
  // just buzzes (the 3-2-1 and rest-done cues themselves are not held back).
  const quiet = !force && !['countdown', 'restDone', 'stop'].includes(event) && restQuiet(useTimer.getState().endsAt);
  const s = trainingSettings(useData.getState().data);
  const shadeDone = event === 'restDone' && isNative() && inShade;
  if ((s.sounds || force) && SOUNDS[event] && !shadeDone && !quiet) {
    sound(SOUNDS[event], { volume: VOLUMES[s.volume] ?? VOLUMES.medium, soft: s.sound_set === 'soft' });
  }
  if (s.vibrate && !shadeDone) buzz(event);
}

/** A light tap for steppers and chips (haptics only, no sound). */
export function tap() {
  if (trainingSettings(useData.getState().data).vibrate) buzz('tap');
}

/** Browsers only allow sound after a tap: call this from the first one. */
export function unlockAudio() {
  if (!isNative()) audio();
}

// Unlock Web Audio on the first touch anywhere, so the first beep isn't lost.
if (!isNative() && globalThis.addEventListener) {
  const once = () => {
    unlockAudio();
    globalThis.removeEventListener('pointerdown', once, true);
  };
  globalThis.addEventListener('pointerdown', once, true);
}
