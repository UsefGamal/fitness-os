// The short intro that plays when the app opens: when it plays, and the one
// line it ends on. Pure helpers, tested in intro.test.js; the animation
// itself is components/Intro.jsx.

/** Total length of the intro in milliseconds (keep it short: it plays on
 * every cold start, including at 6:50 AM before a workout). */
export const INTRO_MS = 1800;

/** Time away from the app after which coming back plays the intro again.
 * Shorter trips (the app's own camera or file picker, a quick glance at a
 * message) don't replay it. */
export const AWAY_MS = 60 * 1000;

/**
 * Whether to play the intro on this open. It always plays (there is no
 * switch for it; an old saved `settings.intro: false` is ignored), except
 * when the system asks for reduced motion, when the app opens on another
 * screen (a reminder or widget tap), and while a workout is in progress, so
 * getting back to the gym floor is never slowed down.
 */
export function shouldPlayIntro({ hash = '', reducedMotion = false, activeWorkout = false }) {
  if (reducedMotion || activeWorkout) return false;
  const route = hash.replace(/^#/, '').split('?')[0];
  return route === '' || route === '/';
}

/** Whether coming back to the app counts as a new open. */
export function isNewOpen(awayMs) {
  return Number.isFinite(awayMs) && awayMs >= AWAY_MS;
}

/**
 * The line under the name: today's session and time, the next session on a
 * rest day, or a welcome before anything is logged.
 * `next` is schedule.programDayFor(); `doneToday` is true once today's
 * session is finished.
 */
export function introLine({ next, time, doneToday = false, firstRun = false }) {
  if (firstRun) return "Let's build your week";
  if (!next) return '';
  if (next.isRestToday) return `Rest day · next: ${next.label}`;
  if (doneToday) return `${next.label} done today. Nice work`;
  return time ? `${next.label} today at ${time}` : `${next.label} today`;
}
