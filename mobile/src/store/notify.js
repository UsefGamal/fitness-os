// Native local notifications (no server, no push service).
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

import { todayISO } from '../lib/dates.js';
import { doneFrom, plannedReminders } from '../lib/reminders.js';
import { reminderRoute } from '../lib/routes.js';
import { activePlan } from '../lib/plan.js';
import { dropFastingReminders, effectiveTimes } from '../lib/ramadan.js';
import { useData } from './useData.js';
import { Device } from './native.js';
import { reminderChecks } from '../lib/reminderHealth.js';

const native = () => Capacitor.isNativePlatform();

export async function enableReminders() {
  if (!native()) return false;
  const perm = await LocalNotifications.requestPermissions();
  return perm.display === 'granted';
}

// P14-12: reminders post on their own channel, private on the lock screen
// (Android shows "Fitness OS" and hides the text until the phone is
// unlocked).
const CHANNEL = 'reminders';
let channelReady = false;
async function ensureChannel() {
  if (channelReady) return;
  try {
    await LocalNotifications.createChannel({ id: CHANNEL, name: 'Reminders', description: 'Sessions and meals you planned', importance: 4, visibility: 0, vibration: true });
  } catch { /* older Android: no channels */ }
  channelReady = true;
}

/** Replace the next two weeks of workout and meal reminders. */
export async function scheduleReminders(content, enabled) {
  if (!native()) return;
  await ensureChannel();
  const pending = await LocalNotifications.getPending();
  // The rest timer lives in RestTimerService now, so every pending one here is a reminder.
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  if (!enabled) return;
  const data = useData.getState().data;
  const { session_moves: moves = [], evening_plan: evening = {} } = data;
  // Ramadan: times move after iftar, and nothing rings in fasting hours.
  const planned = plannedReminders(todayISO(), { ...content, training: activePlan(data, content) }, new Date(), moves, evening, effectiveTimes(data, content, todayISO()), doneFrom(data));
  const list = dropFastingReminders(planned, data)
    .map((r) => ({ id: r.id, title: r.title, body: r.body, channelId: CHANNEL, extra: { route: r.route }, schedule: { at: r.at, allowWhileIdle: true } }));
  if (list.length) await LocalNotifications.schedule({ notifications: list });
}

/** A tapped reminder opens its screen (the workout, the 8 PM session, Meals).
 * Only the routes the app schedules (lib/routes.js), never one from outside. */
export function openFromReminders() {
  if (!native()) return;
  LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
    const route = reminderRoute(notification?.extra?.route);
    if (route) window.location.hash = `#${route}`;
  });
}

/** Keep reminders in step with the data: reschedule (once things settle,
 * well within 5 s) when the times, the plan (routine, my week, moved
 * sessions, 8 PM plan) or what is logged today change, and once per start
 * (P14-12). */
let watching = false;
export function watchReminders(content) {
  if (!native() || watching) return;
  watching = true;
  const key = (d) => {
    // Only today's and later logs matter, which keeps this cheap.
    const today = todayISO();
    const done = doneFrom(d);
    const ahead = (xs) => [...xs].filter((x) => x.slice(0, 10) >= today).sort();
    return JSON.stringify([d.settings?.notifications, d.settings?.times, d.session_moves, d.evening_plan, d.program, ahead(done.workouts), ahead(done.meals)]);
  };
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

// ── "Check reminders" (P14-12) ────────────────────────────────────────

const quiet = async (fn) => {
  try {
    return await fn();
  } catch {
    return null;
  }
};

/** Read the three Android switches reminders depend on. Each is true,
 * false, or null when it can't be read (browser, older Android/APK). */
export async function reminderHealth() {
  if (!native()) return reminderChecks({});
  const perm = await quiet(() => LocalNotifications.checkPermissions());
  const exact = await quiet(() => LocalNotifications.checkExactNotificationSetting());
  const battery = await quiet(() => Device.battery());
  return reminderChecks({
    notifications: perm ? perm.display === 'granted' : null,
    exact: exact ? exact.exact_alarm === 'granted' : null,
    unrestricted: battery ? battery.unrestricted === true : null,
    manufacturer: battery?.manufacturer || '',
  });
}

/** Run a row's Fix: the system dialog or settings screen for it. */
export async function fixReminder(fix) {
  if (!native()) return;
  if (fix === 'notifications') await quiet(() => LocalNotifications.requestPermissions());
  else if (fix === 'exact') await quiet(() => LocalNotifications.changeExactNotificationSetting());
  else if (fix === 'battery') await quiet(() => Device.allowBackground());
  else if (fix === 'autostart') await quiet(() => Device.openAutostart());
}
