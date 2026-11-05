// The short intro that plays when the app opens: when it plays, and the one
// line it ends on. Pure helpers, tested in intro.test.js; the animation
// itself is components/Intro.jsx.

/** Total length of the intro in milliseconds (keep it short: it plays on
 * every cold start, including at 6:50 AM before a workout). */
export const INTRO_MS = 1800;

export function introOn(data) {
  return data?.settings?.intro !== false;
}

export function setIntro(data, on) {
  return { ...data, settings: { ...data.settings, intro: on } };
}

/**
 * Whether to play the intro on this launch. It is skipped when switched off,
 * when the system asks for reduced motion, when the app opens on another
 * screen (a reminder or widget tap), and while a workout is in progress, so
 * getting back to the gym floor is never slowed down.
 */
export function shouldPlayIntro({ data, hash = '', reducedMotion = false, activeWorkout = false }) {
  if (!introOn(data) || reducedMotion || activeWorkout) return false;
  const route = hash.replace(/^#/, '').split('?')[0];
  return route === '' || route === '/';
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
  return `${next.label} today at ${time}`;
}
