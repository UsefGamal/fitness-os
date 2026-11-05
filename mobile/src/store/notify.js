// Native local notifications (no server, no push service).
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

import { todayISO } from '../lib/dates.js';
import { plannedReminders } from '../lib/reminders.js';
import { activePlan } from '../lib/plan.js';
import { timesOf } from '../lib/times.js';
import { useData } from './useData.js';

const native = () => Capacitor.isNativePlatform();

export async function enableReminders() {
  if (!native()) return false;
  const perm = await LocalNotifications.requestPermissions();
  return perm.display === 'granted';
}

/** Replace the next two weeks of workout and meal reminders. */
export async function scheduleReminders(content, enabled) {
  if (!native()) return;
  const pending = await LocalNotifications.getPending();
  // The rest timer lives in RestTimerService now, so every pending one here is a reminder.
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  if (!enabled) return;
  const data = useData.getState().data;
  const { session_moves: moves = [], evening_plan: evening = {} } = data;
  const list = plannedReminders(todayISO(), { ...content, training: activePlan(data, content) }, new Date(), moves, evening, timesOf(data, content)).map((r) => ({ id: r.id, title: r.title, body: r.body, extra: { route: r.route }, schedule: { at: r.at, allowWhileIdle: true } }));
  if (list.length) await LocalNotifications.schedule({ notifications: list });
}

/** A tapped reminder opens its screen (the workout, the 8 PM session, Meals).
 * Only in-app routes, never a URL from outside. */
export function openFromReminders() {
  if (!native()) return;
  LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
    const route = notification?.extra?.route;
    if (typeof route === 'string' && route.startsWith('/') && !route.startsWith('//')) window.location.hash = `#${route}`;
  });
}

/** Keep reminders in step with the data: reschedule (once things settle)
 * when the times, moved sessions or 8 PM plan change, and on each start. */
export function watchReminders(content) {
  if (!native()) return;
  const key = (d) => JSON.stringify([d.settings?.notifications, d.settings?.times, d.session_moves, d.evening_plan]);
  let last = key(useData.getState().data);
  let timer = null;
  const run = () => scheduleReminders(content, Boolean(useData.getState().data.settings?.notifications)).catch(() => {});
  useData.subscribe((s) => {
    const k = key(s.data);
    if (k === last) return;
    last = k;
    clearTimeout(timer);
    timer = setTimeout(run, 1500);
  });
  run(); // also rolls the two-week window forward
}
