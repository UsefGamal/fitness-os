// Sounds and vibration for workout moments, in one place:
//   feedback('restStart' | 'countdown' | 'restDone' | 'stop' | 'workoutStart'
//            | 'workoutSaved' | 'pr' | 'work' | 'rest' | 'test')
// Sounds are synthesised with the Web Audio API (no audio files to license
// or bundle) and follow Settings → Training. On the phone the "rest done"
// sound comes from the notification (RestTimerService), so it plays with the
// screen off too; the app doesn't play it a second time there.
import { trainingSettings, VOLUMES } from '../lib/training.js';
import { isNative } from './native.js';
import { useData } from './useData.js';

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

const VIBRATION = {
  restDone: [200, 100, 200],
  workoutSaved: [60, 60, 120],
  pr: [80, 60, 80, 60, 160],
  work: [120],
  rest: [60],
};

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

/** Play the sound (and buzz) for a workout moment, if switched on. */
export function feedback(event, { force = false } = {}) {
  const s = trainingSettings(useData.getState().data);
  const nativeDone = event === 'restDone' && isNative();
  if ((s.sounds || force) && SOUNDS[event] && !nativeDone) {
    try {
      play(SOUNDS[event], { volume: VOLUMES[s.volume] ?? VOLUMES.medium, soft: s.sound_set === 'soft' });
    } catch {
      // No audio on this device: stay silent.
    }
  }
  if (s.vibrate && VIBRATION[event] && !nativeDone && globalThis.navigator?.vibrate) navigator.vibrate(VIBRATION[event]);
}

/** Browsers only allow sound after a tap: call this from the first one. */
export function unlockAudio() {
  audio();
}
