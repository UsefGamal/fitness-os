// Settings > Reminders > "Check reminders" (P14-12): three things Android
// can quietly switch off, each with a Fix button, plus the steps for phones
// whose maker adds its own app killer (Xiaomi, Infinix, Tecno...). Pure;
// the native checks are in store/notify.js. Tested in reminderHealth.test.js.

/** Makers known to stop apps from waking up, keyed by Build.MANUFACTURER
 * (lower case). The value names the guide in i18n (remind.guide.*). */
export const KILLERS = {
  xiaomi: 'xiaomi', redmi: 'xiaomi', poco: 'xiaomi',
  infinix: 'transsion', tecno: 'transsion', itel: 'transsion',
  oppo: 'oppo', realme: 'oppo', oneplus: 'oppo',
  vivo: 'vivo', huawei: 'huawei', honor: 'huawei', samsung: 'samsung',
};

export function makerGuide(manufacturer) {
  return KILLERS[String(manufacturer || '').toLowerCase().trim()] || null;
}

/** The rows to show: [{ key, ok, fix }]. `fix` names the action the button
 * runs ('notifications' | 'exact' | 'battery' | 'autostart'). A check that
 * couldn't be read (null) is left out rather than shown as a problem. */
export function reminderChecks({ notifications = null, exact = null, unrestricted = null, manufacturer = '' } = {}) {
  const rows = [];
  if (notifications != null) rows.push({ key: 'notifications', ok: notifications, fix: 'notifications' });
  if (exact != null) rows.push({ key: 'exact', ok: exact, fix: 'exact' });
  if (unrestricted != null) rows.push({ key: 'battery', ok: unrestricted, fix: 'battery' });
  const guide = makerGuide(manufacturer);
  if (guide) rows.push({ key: 'autostart', ok: null, fix: 'autostart', guide });
  return rows;
}

/** All the checks that can be read pass. */
export function remindersHealthy(rows) {
  return rows.every((r) => r.ok !== false);
}

/** The one-time permissions step on the first open (Yusuf, 7 Nov 2026):
 * on the phone only, after first-time setup, and never again once it was
 * answered (Allow or Not now). */
export function askPermissionsOnOpen({ native = false, data = null, setup = false } = {}) {
  return Boolean(native && data && !setup && data.settings?.perms_asked !== true);
}

export function markPermissionsAsked(data) {
  return { ...data, settings: { ...data.settings, perms_asked: true } };
}
