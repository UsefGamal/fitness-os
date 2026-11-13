// The Settings pages (E5-S1). The root lists these, one row each, and
// keeps to 10 rows or fewer; each key is a route /settings/<key>.
export const SETTINGS_PAGES = [
  { key: 'data', icon: 'download', title: 'settings.data', note: 'settings.dataNote' },
  { key: 'training', icon: 'play', title: 'settings.training', note: 'settings.trainingNote' },
  { key: 'times', icon: 'timer', title: 'settings.times', note: 'settings.timesNote' },
  { key: 'health', icon: 'heart', title: 'settings.health', note: 'settings.healthNote' },
  { key: 'safety', icon: 'check', title: 'settings.safety', note: 'settings.safetyNote' },
  { key: 'modules', icon: 'star', title: 'settings.modules', note: 'settings.modulesNote' },
  { key: 'about', icon: 'gear', title: 'settings.about', note: 'settings.aboutNote' },
  // Reached from App and about (and from setup), so the root stays short.
  { key: 'install', icon: 'download', title: 'settings.install', note: 'settings.installNote', root: false },
];

/** The pages with a row of their own on the Settings root. */
export const ROOT_PAGES = SETTINGS_PAGES.filter((p) => p.root !== false);

/** Rows on the Settings root: Profile, Quests, one per root page, then
 * Share Fitness OS. */
export const ROOT_ROWS = 2 + ROOT_PAGES.length + 1;

export function pageOf(key) {
  return SETTINGS_PAGES.find((p) => p.key === key) || null;
}
