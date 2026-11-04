// Native local notifications (no server, no push service).
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

import { todayISO } from '../lib/dates.js';
import { plannedReminders } from '../lib/reminders.js';

const native = () => Capacitor.isNativePlatform();
const REST_TIMER_ID = 9001;

export async function enableReminders() {
  if (!native()) return false;
  const perm = await LocalNotifications.requestPermissions();
  return perm.display === 'granted';
}

/** Replace the next two weeks of workout and meal reminders. */
export async function scheduleReminders(content, enabled) {
  if (!native()) return;
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id !== REST_TIMER_ID);
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  if (!enabled) return;
  const list = plannedReminders(todayISO(), content).map((r) => ({ id: r.id, title: r.title, body: r.body, schedule: { at: r.at, allowWhileIdle: true } }));
  if (list.length) await LocalNotifications.schedule({ notifications: list });
}

/** Rest timer end, so it still buzzes with the screen off. */
export async function scheduleRestDone(seconds, exerciseName) {
  if (!native()) return;
  await cancelRestDone();
  await LocalNotifications.schedule({
    notifications: [{ id: REST_TIMER_ID, title: 'Rest done', body: `Next set: ${exerciseName}`, schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true } }],
  });
}

export async function cancelRestDone() {
  if (!native()) return;
  await LocalNotifications.cancel({ notifications: [{ id: REST_TIMER_ID }] });
}
