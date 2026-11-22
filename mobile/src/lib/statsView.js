// Stats page helpers (Nov 2026 redesign). Pure, tested in statsView.test.js.
import { isLoadSet } from './data.js';
import { daysBetween } from './dates.js';
import { GROUPS } from './insights.js';

/** Weekly-set rows (weeklySets.muscleRows) folded into the six groups:
 * [{ group, done, planned, inRange, muscles: rows }] in GROUPS order.
 * done and planned add up the muscles' own counts, so one compound set
 * shows in every muscle it works: the page says so beside the numbers. */
export function groupVolume(rows, guide = { low: 10, high: 20 }) {
  return GROUPS.map((group) => {
    const muscles = rows.filter((r) => r.group === group);
    const sum = (k) => Math.round(muscles.reduce((n, r) => n + r[k], 0) * 2) / 2;
    return {
      group,
      done: sum('done'),
      planned: sum('planned'),
      inRange: muscles.filter((r) => r.done >= guide.low && r.done <= guide.high).length,
      state: groupState(muscles, guide),
      muscles,
    };
  }).filter((g) => g.muscles.length);
}

/** What this week's plan gives a group, in one word (UX-22): 'on_track'
 * when at least half its muscles get a guide-range number of sets, else
 * 'high' when more of them are over the guide than under it, else 'low'. */
export function groupState(muscles, guide = { low: 10, high: 20 }) {
  const good = muscles.filter((r) => r.planned >= guide.low && r.planned <= guide.high).length;
  if (muscles.length && good * 2 >= muscles.length) return 'on_track';
  const high = muscles.filter((r) => r.planned > guide.high).length;
  return high > muscles.length - good - high ? 'high' : 'low';
}

/** One group's recovery status for the map and its label:
 * 'none' (never trained), 'recovering', 'ready' or 'untrained' (7+ days). */
export function groupStatus(state, last) {
  return last ? state : 'none';
}

/** Days since a date, or null. */
export function daysSince(date, today) {
  return date ? daysBetween(date, today) : null;
}

/** Training days in the last `days` (default 182, about 6 months). */
export function activeDays(workouts, today, days = 182) {
  const set = new Set();
  for (const w of workouts) {
    if (!w.log_date || w.log_date > today) continue;
    if (daysBetween(w.log_date, today) < days) set.add(w.log_date);
  }
  return set.size;
}

/** Training days in the last 7 days, today included. Days, not workouts,
 * so a gym session and a walk on the same day count once, the same way
 * the week streak and Home count them (CHART-1). */
export function sessionsLast7(workouts, today) {
  return activeDays(workouts, today, 7);
}

const CATEGORY = {
  first: 'consistency', w10: 'consistency', w50: 'consistency', w100: 'consistency', streak4: 'consistency', streak12: 'consistency', early10: 'consistency',
  pr1: 'strength', pr25: 'strength', bench1: 'strength', squat15: 'strength', dead2: 'strength',
  ton10: 'milestones', ton100: 'milestones', full: 'milestones',
  meals7: 'nutrition',
  lost5: 'body', waist5: 'body',
};
export const BADGE_CATEGORIES = ['consistency', 'strength', 'milestones', 'nutrition', 'body'];

/** Badges grouped by category, in BADGE_CATEGORIES order; an unknown id
 * goes to milestones so a new badge is never hidden. */
export function badgeGroups(all) {
  const out = Object.fromEntries(BADGE_CATEGORIES.map((c) => [c, []]));
  for (const b of all) out[CATEGORY[b.id] || 'milestones'].push(b);
  return BADGE_CATEGORIES.map((c) => ({ key: c, badges: out[c] })).filter((g) => g.badges.length);
}

/** The most recently earned badge with a date, or null. */
export function latestBadge(all) {
  return all.filter((b) => b.earned && b.date).sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
}

/** First date each exercise got a load set: Map(exercise_id -> date). */
export function firstLoadDates(workouts) {
  const out = new Map();
  for (const w of workouts) {
    for (const s of w.sets) {
      if (!isLoadSet(s) || !(s.weight_kg > 0)) continue;
      const cur = out.get(s.exercise_id);
      if (!cur || w.log_date < cur) out.set(s.exercise_id, w.log_date);
    }
  }
  return out;
}

/** Records count and those set in the last `days` (default 30). A best
 * from an exercise's very first session isn't new: there was nothing to
 * beat (CHART-1; without `firstDates` every best counts, as before). */
export function recordSummary(bests, today, days = 30, firstDates = null) {
  const list = [...bests];
  const beatSomething = (b) => !firstDates || (firstDates.get(b.exercise_id) || b.log_date) < b.log_date;
  return { total: list.length, recent: list.filter((b) => b.log_date && daysBetween(b.log_date, today) < days && beatSomething(b)).length };
}

/** Change across an e1RM series [{ date, value }]: { now, change } or null. */
export function seriesChange(points) {
  if (!points.length) return null;
  const now = points[points.length - 1].value;
  return { now, change: Math.round((now - points[0].value) * 10) / 10 };
}

/** The Stats tabs in order (UX-21). Overview holds the streak and
 * consistency; Body is there only while the weight module is on. */
export function statsTabs(weightOn) {
  return ['overview', 'muscles', 'strength', ...(weightOn ? ['body'] : []), 'badges'];
}

/** The hardest step of each badge family: gold once earned, so a rare
 * badge looks rare (Badges review, 22 Nov). */
export const SPECIAL_BADGES = new Set(['w100', 'streak12', 'pr25', 'ton100', 'dead2']);
export const BADGE_FILTERS = ['all', 'progress', 'earned'];

/** 'earned' | 'progress' (started, not done) | 'locked' (nothing yet). */
export function badgeState(b) {
  if (b.earned) return 'earned';
  return b.fraction > 0 ? 'progress' : 'locked';
}

/** How many badges are in each state, plus all. */
export function badgeCounts(all) {
  const out = { all: all.length, earned: 0, progress: 0, locked: 0 };
  for (const b of all) out[badgeState(b)] += 1;
  return out;
}

const STATE_ORDER = { earned: 0, progress: 1, locked: 2 };

/**
 * The Badges list for a filter ('all' | 'progress' | 'earned'): categories
 * in order, each { key, badges, earned, total, open }. Inside a category,
 * earned come first (newest first), then started ones (closest first),
 * then locked, so locked badges never lead. earned/total count the whole
 * category whatever the filter. A category with nothing left after the
 * filter is dropped. open: on 'all', only categories with something
 * earned or started start open, so a new user's page is short.
 */
export function badgeSections(all, filter = 'all') {
  return badgeGroups(all).map((g) => {
    const keep = g.badges
      .filter((b) => filter === 'all' || badgeState(b) === filter)
      .map((b, i) => ({ b, i }))
      .sort((x, y) => {
        const sx = badgeState(x.b);
        const sy = badgeState(y.b);
        if (sx !== sy) return STATE_ORDER[sx] - STATE_ORDER[sy];
        if (sx === 'earned' && x.b.date !== y.b.date) return (y.b.date || '') < (x.b.date || '') ? -1 : 1;
        if (sx === 'progress' && x.b.fraction !== y.b.fraction) return y.b.fraction - x.b.fraction;
        return x.i - y.i;
      })
      .map((x) => x.b);
    const earned = g.badges.filter((b) => b.earned).length;
    const open = filter !== 'all' || g.badges.some((b) => badgeState(b) !== 'locked');
    return { key: g.key, badges: keep, earned, total: g.badges.length, open };
  }).filter((g) => g.badges.length);
}
