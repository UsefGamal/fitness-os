// Keeps the phone extras in step with the data: the home-screen widget, the
// rest timer in the shade, and Health Connect (when switched on in Settings).
import { App } from '@capacitor/app';

import { todayISO } from '../lib/dates.js';
import { healthWorkouts, mergeWeighIns } from '../lib/health.js';
import { widgetDays } from '../lib/widget.js';
import { Health, isNative, Widget } from './native.js';
import { content, flushSave, useData } from './useData.js';
import { useTimer } from './useTimer.js';

let widgetTimer = null;

function pushWidget() {
  clearTimeout(widgetTimer);
  widgetTimer = setTimeout(() => {
    Widget.update({ days: widgetDays(useData.getState().data, content, todayISO()) }).catch(() => {});
  }, 800);
}

export function healthSettings(data) {
  return { enabled: false, weights_since: 0, workouts_since: 0, ...(data.settings?.health || {}) };
}

function setHealth(changes) {
  useData.getState().update((d) => ({ ...d, settings: { ...d.settings, health: { ...healthSettings(d), ...changes } } }));
}

/** Pull new weigh-ins and push workouts finished since the last sync. Returns a summary. */
export async function syncHealth({ all = false } = {}) {
  const h = healthSettings(useData.getState().data);
  if (!isNative() || !h.enabled) return null;
  const startedAt = Date.now();
  // Look a day back so a weigh-in synced late from a scale isn't missed.
  const { weights } = await Health.readWeights({ since: all ? 0 : Math.max(0, h.weights_since - 86400000) });
  let added = 0;
  useData.getState().update((d) => {
    const r = mergeWeighIns(d, weights);
    added = r.added;
    return r.data;
  });
  const since = all ? 0 : h.workouts_since;
  const workouts = healthWorkouts(useData.getState().data, content.training.session_time).filter((w) => w.version > since);
  if (workouts.length) await Health.writeWorkouts({ workouts });
  setHealth({ weights_since: startedAt, workouts_since: startedAt });
  return { weighIns: added, workouts: workouts.length };
}

export function startPhoneSync() {
  if (!isNative()) return;
  pushWidget();
  useData.subscribe((s, prev) => {
    if (s.data !== prev.data) pushWidget();
  });
  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      flushSave(); // the app may be killed in the background: write now
      return;
    }
    pushWidget();
    useTimer.getState().sync();
    syncHealth().catch(() => {});
  });
  useTimer.getState().sync();
  syncHealth().catch(() => {});
}
