// Feature flags (E1-S5). A flag lets unfinished work merge without
// reaching anyone: it is on in debug builds and off in release builds,
// and a route behind an off flag is left out of the router, so it can't
// be opened by a link, a reminder or a widget either.
//
// To add one: put it in FLAGS with release: false while it is being
// built, wrap its route or entry point in flagOn(), and flip release to
// true (or delete the flag) when it ships.

export const FLAGS = {
  // Example kept so the mechanism stays tested; remove when a real flag lands.
  example_lab: { release: false, note: 'A test screen that only debug builds show' },
};

/** Whether `name` is on for a build. `release` is true for signed release
 * builds (vite.config.js sets __RELEASE__ from FITNESS_OS_RELEASE). */
export function flagOn(name, { release }) {
  const flag = FLAGS[name];
  if (!flag) return false;
  return release ? flag.release === true : true;
}

/** Routes without a flag, plus flagged ones whose flag is on. */
export function routesFor(routes, build) {
  return routes.filter((r) => !r.flag || flagOn(r.flag, build));
}
