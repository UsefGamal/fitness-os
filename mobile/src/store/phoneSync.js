// Keeps the phone extras in step with the data: the home-screen widget, the
// rest timer in the shade, and Health Connect (when switched on in Settings).
import { maybeBackup } from './autoBackup.js';
import { App } from '@capacitor/app';

import { todayISO } from '../lib/dates.js';
import { mergeDaily } from '../lib/activity.js';
import { linkRoute } from '../lib/routes.js';
import { clearHealthDeletes, pendingHealthDeletes, healthWorkouts, mergeWeighIns } from '../lib/health.js';
import { timesOf } from '../lib/times.js';
import { widgetDays } from '../lib/widget.js';
import { openFromReminders, watchReminders } from './notify.js';
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

// Widget taps open fitnessos://open/<route>; lib/routes.js allows only a few screens.
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
  // Each step on its own (audit AND-1): losing "read weight" no longer
  // stops workouts from being shared. A step that fails keeps its "since",
  // so the next sync tries it again; nothing is marked done that wasn't.
  const failed = [];
  let added = 0;
  try {
    // Look a day back so a weigh-in synced late from a scale isn't missed.
    const { weights } = await Health.readWeights({ since: all ? 0 : Math.max(0, h.weights_since - 86400000) });
    useData.getState().update((d) => {
      const r = mergeWeighIns(d, weights);
      added = r.added;
      return r.data;
    });
  } catch {
    failed.push('weights');
  }
  const since = all ? 0 : h.workouts_since;
  const workouts = healthWorkouts(useData.getState().data, timesOf(useData.getState().data, content).session_time).filter((w) => w.version > since);
  try {
    if (workouts.length) await Health.writeWorkouts({ workouts });
  } catch {
    failed.push('workouts');
  }
  // Workouts deleted in the app leave Health Connect too (DA-5).
  const gone = pendingHealthDeletes(useData.getState().data);
  if (gone.length) {
    try {
      await Health.deleteWorkouts({ ids: gone });
      useData.getState().update((d) => clearHealthDeletes(d, gone));
    } catch {
      failed.push('deletes');
    }
  }
  setHealth({
    ...(failed.includes('weights') ? {} : { weights_since: startedAt }),
    ...(failed.includes('workouts') ? {} : { workouts_since: startedAt }),
  });
  const days = await readDaily(all ? 60 : 15);
  // What worked is kept; a failed step is said, not swallowed (most likely a removed permission).
  if (failed.length) throw new Error(failed.includes('weights') ? 'Health Connect didn’t let Tafra read weight. Check its permissions.' : 'Health Connect didn’t take the workouts. Check its permissions.');
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
  openFromReminders();
  watchReminders(content);
  pushWidget();
  useData.subscribe((s, prev) => {
    if (s.data !== prev.data) pushWidget();
  });
  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      flushSave(true); // the app may be killed in the background: write now, file too
      maybeBackup(); // BAK-1: today's backup, if one is due
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
  maybeBackup();
}
