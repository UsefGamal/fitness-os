// The Settings pages and the hub that leads to them (E5-S1, redesigned
// 19 Nov 2026 from Yusuf's spec): six categories in two groups, a search
// over every setting, and one route /settings/<key> per page.
export const SETTINGS_PAGES = [
  { key: 'training', icon: 'play', title: 'settings.training', note: 'settings.trainingNote' },
  { key: 'times', icon: 'bell', title: 'settings.times', note: 'settings.timesNote' },
  { key: 'data', icon: 'download', title: 'settings.data', note: 'settings.dataNote' },
  { key: 'prefs', icon: 'gear', title: 'settings.prefs', note: 'settings.prefsNote' },
  { key: 'about', icon: 'info', title: 'settings.about', note: 'settings.aboutNote' },
  // Reached from App preferences.
  { key: 'modules', icon: 'star', title: 'settings.modules', note: 'settings.modulesNote', root: false },
  { key: 'safety', icon: 'check', title: 'settings.safety', note: 'settings.safetyNote', root: false },
  { key: 'health', icon: 'heart', title: 'settings.health', note: 'settings.healthNote', root: false },
  // Reached from Help & about (and from setup).
  { key: 'install', icon: 'download', title: 'settings.install', note: 'settings.installNote', root: false },
  { key: 'help', icon: 'info', title: 'settings.help', note: 'settings.helpNote', root: false },
  { key: 'privacy', icon: 'lock', title: 'settings.privacy', note: 'settings.privacyNote', root: false },
];

export function pageOf(key) {
  return SETTINGS_PAGES.find((p) => p.key === key) || null;
}

const row = (key, to) => {
  const p = pageOf(key);
  return { key, to: to || `/settings/${key}`, icon: p.icon, title: p.title, note: p.note };
};

/** The hub: two groups of three categories. Profile & goals is its own
 * screen (/profile); the rest are Settings pages. */
export const SETTINGS_GROUPS = [
  {
    label: 'settings.groupPersonal',
    rows: [
      { key: 'profile', to: '/profile', icon: 'user', title: 'settings.profile', note: 'settings.profileNote' },
      row('training'),
      row('times'),
    ],
  },
  { label: 'settings.groupApp', rows: [row('data'), row('prefs'), row('about')] },
];

/** Rows on the hub. */
export const ROOT_ROWS = SETTINGS_GROUPS.reduce((a, g) => a + g.rows.length, 0);

/**
 * Every setting the search finds: its label (an i18n key), the page it is
 * on, and other words people may type for it.
 */
export const SETTINGS_INDEX = [
  { label: 'settings.profile', to: '/profile', words: 'body weight height age goal calories macros protein target' },
  { label: 'set.restBig', to: '/settings/training', words: 'rest timer compound' },
  { label: 'set.restSmall', to: '/settings/training', words: 'rest timer isolation' },
  { label: 'set.autoRest', to: '/settings/training', words: 'rest timer start automatic' },
  { label: 'set.targetLength', to: '/settings/training', words: 'workout length minutes duration' },
  { label: 'levels.title', to: '/settings/training', words: 'level experience beginner intermediate experienced' },
  { label: 'set.equipment', to: '/settings/training', words: 'equipment gym home dumbbell barbell cable machine' },
  { label: 'set.sounds', to: '/settings/training', words: 'sound volume beep chime' },
  { label: 'settings.vibration', to: '/settings/training', words: 'vibrate haptics buzz' },
  { label: 'gym.title', to: '/settings/training', words: 'gym mode big buttons' },
  { label: 'set.barPlates', to: '/settings/training', words: 'bar plates barbell warm-up' },
  { label: 'week.startsOn', to: '/settings/times', words: 'week start sunday monday' },
  { label: 'set.sessionTimes', to: '/settings/times', words: 'morning evening session time workout' },
  { label: 'set.reminders', to: '/settings/times', words: 'reminders notifications alerts' },
  { label: 'set.mealTimes', to: '/settings/times', words: 'meal times breakfast lunch dinner' },
  { label: 'settings.quests', to: '/quests', words: 'quests badges points' },
  { label: 'ramadan.title', to: '/settings/times', words: 'ramadan fasting suhoor iftar' },
  { label: 'set.exportBackup', to: '/settings/data', words: 'backup export save file' },
  { label: 'set.importBackup', to: '/settings/data', words: 'import restore backup file' },
  { label: 'set.snapshots', to: '/snapshots', words: 'snapshots undo copies' },
  { label: 'set.exportCsv', to: '/settings/data', words: 'csv spreadsheet export excel' },
  { label: 'set.importStrong', to: '/settings/data', words: 'strong hevy import csv' },
  { label: 'share.title', to: '/settings/data', words: 'share copy' },
  { label: 'set.autoBackup', to: '/settings/data', words: 'automatic backup cloud drive folder' },
  { label: 'theme.title', to: '/settings/prefs', words: 'theme dark light look appearance colour' },
  { label: 'theme.textSize', to: '/settings/prefs', words: 'text size font bigger' },
  { label: 'settings.modules', to: '/settings/modules', words: 'modules hide show water widget' },
  { label: 'settings.safety', to: '/settings/safety', words: 'safety check hide weight calories' },
  { label: 'settings.health', to: '/settings/health', words: 'health connect watch steps sleep heart' },
  { label: 'settings.help', to: '/settings/help', words: 'help questions faq' },
  { label: 'settings.privacy', to: '/settings/privacy', words: 'privacy delete everything' },
  { label: 'about.update', to: '/settings/about', words: 'update version download' },
  { label: 'about.report', to: '/settings/about', words: 'bug report problem' },
  { label: 'whatsNew.title', to: '/settings/about', words: "what's new changes" },
  { label: 'settings.share', to: '/settings/about', words: 'share app friends link' },
  { label: 'settings.install', to: '/settings/install', words: 'install update samsung xiaomi' },
];

/**
 * The settings that match what was typed: every word typed must start a
 * word of the label (as `tr` gives it) or of its other words. Labels that
 * match come first. An empty search finds nothing.
 * @param {string} query
 * @param {(key: string) => string} tr
 */
export function searchSettings(query, tr) {
  const typed = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!typed.length) return [];
  const wordsOf = (s) => s.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean);
  const hits = [];
  for (const item of SETTINGS_INDEX) {
    const label = wordsOf(tr(item.label));
    const all = [...label, ...wordsOf(item.words)];
    if (!typed.every((q) => all.some((w) => w.startsWith(q)))) continue;
    const inLabel = typed.every((q) => label.some((w) => w.startsWith(q)));
    hits.push({ ...item, rank: inLabel ? 0 : 1 });
  }
  return hits.sort((a, b) => a.rank - b.rank).map(({ rank, ...item }) => item);
}
