// The short intro that plays when the app opens: when it plays, and the one
// line it ends on. Pure helpers, tested in intro.test.js; the animation
// itself is components/Intro.jsx.

/** Length of each kind of intro in milliseconds (components/Intro.jsx).
 * "full" (the leap) plays on the first open of the day, "short" (a straight
 * jump) on later opens, "fade" (the still mark fades, nothing moves) when
 * Reduce motion is on. */
export const INTRO_MS = { full: 1900, short: 800, fade: 200 };

/** The golden ratio: the intro page's sizes and gaps step down by it. */
export const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * The direction the mark flies: along the slit between the ط's stem and its
 * tail blade, the mean of the slit's two edges in the mark's 24 grid,
 * (1.35, 20.79) to (14.34, 13.9) and (4.62, 20.84) to (19.2, 14.69). A unit
 * vector in screen space (y down): about 25 degrees above the horizon, right.
 */
export function slitDir() {
  const unit = ([x, y]) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
  const a = unit([14.34 - 1.35, 13.9 - 20.79]);
  const b = unit([19.2 - 4.62, 14.69 - 20.84]);
  return unit([a[0] + b[0], a[1] + b[1]]);
}

/**
 * Where things sit on the intro page, for a screen `height` px tall and a
 * mark `mark` px wide (the Android splash size). The name is the mark / phi^2,
 * the slogan the name / phi^2, the gaps shrink by phi, the launch pad is the
 * mark / phi wide, and the group is centred on the upper golden line.
 */
export function goldenLayout(height, mark = 104) {
  const title = Math.round(mark / PHI / PHI);
  const sub = Math.round(title / PHI / PHI);
  const gap1 = Math.round(title / PHI);
  const gap2 = Math.round(sub / PHI);
  const groupH = mark + gap1 + title * 1.1 + gap2 + sub * 1.25;
  const top = height / PHI / PHI - groupH / 2;
  return {
    title, sub, pad: Math.round(mark / PHI),
    markY: top + mark / 2,
    titleTop: top + mark + gap1,
    subTop: top + mark + gap1 + title * 1.1 + gap2,
    padTop: top + mark * 21 / 24 + 2,
  };
}

/**
 * Which intro plays on this open: null (none), "fade", "short" or "full".
 * The full leap plays once a day; `lastFullOn` is the day it last played.
 */
export function introKind({ hash = '', reducedMotion = false, activeWorkout = false, today = '', lastFullOn = null }) {
  if (!shouldPlayIntro({ hash, activeWorkout })) return null;
  if (reducedMotion) return 'fade';
  return lastFullOn === today ? 'short' : 'full';
}

/** Time away from the app after which coming back plays the intro again.
 * Shorter trips (the app's own camera or file picker, a quick glance at a
 * message) don't replay it. */
export const AWAY_MS = 60 * 1000;

/**
 * Whether to play the intro on this open. It always plays (there is no
 * switch for it; an old saved `settings.intro: false` is ignored), except
 * when reduced motion is asked for (then introKind gives the 0.2 s fade
 * instead), when the app opens on another
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
 * The line under the slogan: today's session and time, or the next session
 * on a rest day. Nothing on the first open (the slogan says enough).
 * `next` is schedule.programDayFor(); `doneToday` is true once today's
 * session is finished.
 */
export function introLine({ next, time, doneToday = false, firstRun = false }) {
  if (firstRun) return '';
  if (!next) return '';
  if (next.isRestToday) return `Rest day · next: ${next.label}`;
  if (doneToday) return `${next.label} done today. Nice work`;
  return time ? `${next.label} today at ${time}` : `${next.label} today`;
}
