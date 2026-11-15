// Help, Privacy and Delete everything (HELP-1: BIZ-5, SEC-23, SEC-21).
// Pure helpers; the words live in i18n/en.js under help.* and privacy.*.

/** The ten questions on Settings > Help, in order. Each has help.<key>.q and
 * help.<key>.a. */
export const HELP_KEYS = ['update', 'backup', 'newPhone', 'move', 'swap', 'rir', 'weights', 'kcal', 'timer', 'missed'];

/** Every place a copy of your data can be, in order: privacy.<key>.title
 * and privacy.<key>.line. */
export const PRIVACY_KEYS = ['phone', 'photos', 'backup', 'exports', 'share', 'health', 'widget', 'reminders', 'report', 'internet'];

/** What is switched on for each row now: 'on' | 'off' | null (nothing to
 * switch). Counts go with the phone and photos rows. */
export function privacyState(data) {
  const s = data?.settings || {};
  const photos = Array.isArray(data?.progress_photos) ? data.progress_photos.length : 0;
  return {
    phone: { state: null, workouts: data?.workouts?.length || 0, weighIns: data?.body_logs?.length || 0 },
    photos: { state: photos ? 'on' : 'off', count: photos, locked: s.photo_lock !== false },
    backup: { state: s.auto_backup?.on === true ? 'on' : 'off' },
    exports: { state: null },
    share: { state: null },
    health: { state: s.health?.enabled === true ? 'on' : 'off' },
    widget: { state: null },
    reminders: { state: s.notifications === true ? 'on' : 'off' },
    report: { state: null },
    internet: { state: null },
  };
}

/** The word to type before Delete everything goes ahead. */
export const DELETE_WORD = 'DELETE';

/** True only for the word itself (any case, spaces around ignored). */
export function deleteConfirmed(typed) {
  return String(typed ?? '').trim().toUpperCase() === DELETE_WORD;
}

/** The Health Connect ids this app wrote: one per workout, plus any still
 * waiting to be deleted there. Numbers only, no repeats. */
export function healthIdsToDelete(data) {
  const ids = new Set();
  for (const w of data?.workouts || []) if (Number.isInteger(w?.id)) ids.add(w.id);
  for (const id of data?.settings?.health?.deleted_workouts || []) if (Number.isInteger(id) && id > 0) ids.add(id);
  return [...ids];
}
