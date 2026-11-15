// What TalkBack says at the moments that matter during a workout and a meal
// day (A11Y-1): set logged, new record, rest over, meal ticked. One polite
// live region in the app shell speaks whatever `announce()` is given, so the
// words don't depend on which screen or which version of the timer is up.
import { setFields } from './sets.js';
import { t } from './i18n.js';

/** @type {Set<(text: string) => void>} */
const listeners = new Set();

/** Says `text` once through the app's live region. Empty text is ignored. */
export function announce(text) {
  const line = String(text || '').trim();
  if (!line) return;
  for (const fn of listeners) fn(line);
}

/** Listens for announcements; returns the unsubscribe. */
export function onAnnounce(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** "Set 2 logged: 60 kg × 8." plus the record line when it's a best or a
 * first baseline. `setNo` counts work sets, as on the screen.
 * @param {{ setNo: number, set: { reps: number, weight_kg?: number, track?: string, duration_s?: number }, name: string, kind?: string | null }} p */
export function setLoggedLine({ setNo, set, name, kind = null }) {
  const kg = set.weight_kg || 0;
  const what = setFields(set).track === 'time'
    ? t(kg > 0 ? 'say.holdKg' : 'say.hold', { s: set.reps, kg })
    : t(kg > 0 ? 'say.liftKg' : 'say.lift', { reps: set.reps, kg });
  const first = t('say.setLogged', { n: setNo, what, name });
  if (kind === 'best') return `${first} ${t('say.best')}`;
  if (kind === 'baseline') return `${first} ${t('say.baseline')}`;
  return first;
}

/** "Breakfast ticked. 3 of 5 meals eaten." or "Breakfast not eaten."
 * @param {{ meal: string, eaten: boolean, done: number, total: number }} p */
export function mealTickLine({ meal, eaten, done, total }) {
  if (!eaten) return t('say.mealUnticked', { meal });
  if (done >= total) return t('say.mealsAll', { meal });
  return t('say.mealTicked', { meal, done, total });
}
