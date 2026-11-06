// Is the person's data actually on disk? (QA-07, TL-09.) Each save writes
// two copies: localStorage and, on the phone, the file mirror. One good copy
// is enough; when every copy the platform has fails, the data lives only in
// memory and a kill would lose it, so the app must say so. Pure; tested in
// saveHealth.test.js.

export const SAVE_OK = { local: null, file: null, failing: false, since: null };

/** Fold one write result into the state. `channel` 'local' | 'file',
 * `ok` true/false, `hasFile` whether this platform has a file mirror,
 * `now` ms. A copy not written yet (null) counts as neither. */
export function recordSave(state, channel, ok, { hasFile = false, now = Date.now() } = {}) {
  const next = { ...state, [channel]: ok };
  const channels = hasFile ? [next.local, next.file] : [next.local];
  const anyOk = channels.some((c) => c === true);
  const allFailed = channels.every((c) => c === false);
  const failing = !anyOk && allFailed;
  return { ...next, failing, since: failing ? state.since ?? now : null };
}
