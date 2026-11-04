// Native local notifications (no server, no push service).
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

import { todayISO } from '../lib/dates.js';
import { plannedReminders } from '../lib/reminders.js';

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
  const list = plannedReminders(todayISO(), content).map((r) => ({ id: r.id, title: r.title, body: r.body, schedule: { at: r.at, allowWhileIdle: true } }));
  if (list.length) await LocalNotifications.schedule({ notifications: list });
}
