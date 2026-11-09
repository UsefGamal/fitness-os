// Which screens a tap from outside the app may open. A widget tap arrives
// as fitnessos://open/<name>, and a reminder tap carries its route in the
// notification's extras. Any app on the phone can send MainActivity an
// intent shaped like either (pentest AND-02, JS-04), so both are matched
// against fixed lists, never used as they come.

const LINKS = new Map([['workout', '/workout'], ['plan', '/plan'], ['meals', '/meals']]);

/** fitnessos://open/<name> -> an app route, or null. */
export function linkRoute(url) {
  const m = /^fitnessos:\/\/open\/([a-z]+)\/?$/.exec(typeof url === 'string' ? url : '');
  return m ? LINKS.get(m[1]) || null : null;
}

// The routes lib/reminders.js schedules: the session, meals, the plan, and
// the 8 PM plan's recovery session or an interval preset (lib/evening.js).
const REMINDER_ROUTES = [/^\/(workout|meals|plan)$/, /^\/session\/recovery$/, /^\/intervals\?preset=[a-z0-9_-]{1,40}$/];

/** A reminder's route when it is one the app schedules, else null. */
export function reminderRoute(route) {
  if (typeof route !== 'string') return null;
  return REMINDER_ROUTES.some((re) => re.test(route)) ? route : null;
}
