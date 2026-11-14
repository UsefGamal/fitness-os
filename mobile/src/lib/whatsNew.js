// "What's new" after an update (E1-S6): on Home, the app lists in a few
// plain lines everything that changed since the version this phone last
// saw notes for. Which notes to show is decided here; the notes themselves
// are in whatsNewNotes.js. The last version whose notes were shown (or that
// a new install started on) is kept in settings.whats_new_seen.

/** "0.9.5" -> [0, 9, 5]; null for anything that isn't a release version. */
export function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** <0, 0 or >0 like a sort comparator; null when either isn't a version. */
export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// 0.9.9 and 1.0.0 shipped without notes, and those builds marked themselves
// as seen anyway. A phone that says it saw one of them really last saw
// 0.9.8's notes, so it still gets everything after that.
const NOTELESS_BUILDS = { '0.9.9': '0.9.8', '1.0.0': '0.9.8' };

/** The version whose notes this phone really saw last, or null. */
export function lastSeen(data) {
  const seen = data.settings?.whats_new_seen;
  if (!parseVersion(seen)) return null;
  return NOTELESS_BUILDS[seen] ?? seen;
}

/** Has this phone been used yet? A new install has nothing to compare with. */
function hasHistory(data) {
  return Boolean(data.workouts?.length || data.meal_logs?.length || data.body_logs?.length);
}

/** Every note up to this build, newest first (for Settings > About). */
export function notesUpTo(current, notes) {
  if (!parseVersion(current)) return [];
  return notes
    .filter((n) => compareVersions(n.version, current) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version));
}

/** The notes to show on open, newest first: every version after the one
 * last seen, up to this build. An updated phone that never saw a note gets
 * only the latest one; a new install and a dev build get none. */
export function unseenNotes(data, current, notes) {
  const upTo = notesUpTo(current, notes);
  if (!upTo.length) return [];
  const seen = lastSeen(data);
  if (seen) return upTo.filter((n) => compareVersions(n.version, seen) > 0);
  return hasHistory(data) ? upTo.slice(0, 1) : [];
}

/** Remember that this build's notes were seen (or skipped by a new install). */
export function markSeen(data, current) {
  if (!parseVersion(current) || data.settings?.whats_new_seen === current) return data;
  return { ...data, settings: { ...data.settings, whats_new_seen: current } };
}
