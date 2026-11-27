// What each screen was showing (tab, filter, search, picked day), kept
// while the app runs, so going into a page and coming back, by Back or by
// the tab bar, opens the same view (Yusuf, 27 Nov: "going inside Library
// and back again you should see the same view selected"). Memory only: a
// fresh start opens every screen as new. A value saved with a `day` is
// dropped once that day is over, so yesterday's picked day doesn't come back.

const MAX = 200;
const store = new Map();

/**
 * The value saved under `key`, else `fallback`.
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @param {string} [day] the day the value belongs to (YYYY-MM-DD), if any
 * @returns {T}
 */
export function recall(key, fallback, day) {
  const e = store.get(key);
  if (!e || (e.day ?? null) !== (day ?? null)) return fallback;
  return e.value;
}

/**
 * Save `value` under `key`; the oldest go once there are MAX.
 * @param {string} key
 * @param {unknown} value
 * @param {string} [day]
 */
export function remember(key, value, day) {
  store.delete(key);
  store.set(key, { value, day: day ?? null });
  while (store.size > MAX) store.delete(store.keys().next().value);
}

/** Forget every screen (Delete everything, tests). */
export function forgetViews() {
  store.clear();
}
