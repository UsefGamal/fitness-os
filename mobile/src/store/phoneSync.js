// Keeps the phone extras in step with the data: the home-screen widget, the
// rest timer in the shade, and Health Connect (when switched on in Settings).
import { App } from '@capacitor/app';

import { todayISO } from '../lib/dates.js';
import { mergeDaily } from '../lib/activity.js';
import { healthWorkouts, mergeWeighIns } from '../lib/health.js';
import { timesOf } from '../lib/times.js';
import { widgetDays } from '../lib/widget.js';
import { watchReminders } from './notify.js';
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

// Widget taps open fitnessos://open/<route>; only these screens are allowed.
const LINKS = { workout: '/workout', plan: '/plan', meals: '/meals' };

export function linkRoute(url) {
  const m = /^fitnessos:\/\/open\/([a-z]+)/.exec(url || '');
  return m ? LINKS[m[1]] || null : null;
}

function openDeepLink(url) {
  const route = linkRoute(url);
  if (route) window.location.hash = `#${route}`;
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
  const workouts = healthWorkouts(useData.getState().data, timesOf(useData.getState().data, content).session_time).filter((w) => w.version > since);
  if (workouts.length) await Health.writeWorkouts({ workouts });
  setHealth({ weights_since: startedAt, workouts_since: startedAt });
  const days = await readDaily(all ? 60 : 15);
  return { weighIns: added, workouts: workouts.length, days };
}

/** Steps, active calories, sleep and resting heart rate, when allowed. An
 * older APK without readDaily, or no permission, just gives nothing. */
async function readDaily(n) {
  try {
    const { days } = await Health.readDaily({ days: n });
    if (!days?.length) return 0;
    useData.getState().update((d) => mergeDaily(d, days, todayISO()));
    return days.length;
  } catch {
    return 0;
  }
}

export function startPhoneSync() {
  if (!isNative()) return;
  watchReminders(content);
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
  App.addListener('appUrlOpen', ({ url }) => openDeepLink(url));
  App.getLaunchUrl().then((r) => openDeepLink(r?.url)).catch(() => {});
  useTimer.getState().sync();
  syncHealth().catch(() => {});
}
