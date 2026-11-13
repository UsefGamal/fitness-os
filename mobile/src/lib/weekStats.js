// The Sunday wrap-up (WRAP-1): a calm look back at the week that ended,
// effort only. Pure helpers, tested in weekStats.test.js.
//
// What never goes in here: weight, body measurements, calories, Ramadan
// state or safety answers. The wrap-up, its picture and the "send my week"
// text are built from this object only, so leaving them out here keeps
// them out everywhere.
import { isWorkSet } from './data.js';
import { addDays, fromISO, LOCALE, weekStart } from './dates.js';
import { t as tr } from './i18n.js';
import { plannedPerWeek, weekNeed, weekStreaks } from './insights.js';
import { macroTargets } from './macros.js';
import { gateOn, kcalHidden } from './safety.js';

/** Days a watch average needs before it is shown. */
export const MIN_WORN_DAYS = 3;
/** Share of the protein target that counts as reaching it. */
export const PROTEIN_SHARE = 0.9;

const dayMonth = (iso) => fromISO(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
const days = (start) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

/** The plan block running in the week starting `weekIso`, or null. */
function blockFor(data, weekIso) {
  const end = addDays(weekIso, 6);
  const blocks = (data?.program?.blocks || []).filter((b) => b && b.started_on).sort((a, b) => (a.started_on < b.started_on ? -1 : 1));
  let block = blocks[0] || null;
  for (const b of blocks) if (b.started_on <= end) block = b;
  return block;
}

/** Protein eaten on a date: ticked plan meals at the numbers copied when
 * ticked (DA-1), and meals logged as something else at their own. */
function proteinOn(data, date) {
  let sum = 0;
  for (const m of data.meal_logs || []) {
    if (m.log_date !== date || !m.completed) continue;
    sum += Number((m.custom || m.eaten)?.protein) || 0;
  }
  return sum;
}

function average(values) {
  return values.length >= MIN_WORN_DAYS ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/** The week that starts on `weekIso` (a Sunday), in effort only. */
export function weekStats(data, content, weekIso) {
  const start = weekStart(weekIso);
  const dates = days(start);
  const inWeek = new Set(dates);
  const end = dates[6];
  const workouts = (data.workouts || []).filter((w) => inWeek.has(w.log_date));
  const trainedDays = new Set(workouts.map((w) => w.log_date));
  const workSets = workouts.reduce((n, w) => n + (w.sets || []).filter(isWorkSet).length, 0);
  const planned = plannedPerWeek(blockFor(data, start));

  const slots = content.nutrition.meal_slots.length;
  const ticked = new Map();
  for (const m of data.meal_logs || []) if (m.completed && inWeek.has(m.log_date)) ticked.set(m.log_date, (ticked.get(m.log_date) || 0) + 1);
  const mealDays = dates.filter((d) => (ticked.get(d) || 0) >= slots).length;

  // Protein only when it is safe to talk about food numbers: not under the
  // protein limit, and not with calories hidden.
  const proteinOff = gateOn(data, 'protein_cap', end) || kcalHidden(data);
  const proteinDays = proteinOff ? null : dates.filter((d) => {
    const target = macroTargets(data, content.nutrition, d).protein;
    return target > 0 && proteinOn(data, d) >= target * PROTEIN_SHARE;
  }).length;

  const health = data.health_daily || {};
  const steps = average(dates.map((d) => health[d]?.steps).filter((v) => v > 0));
  const sleepMin = average(dates.map((d) => health[d]?.sleep_min).filter((v) => v > 0));

  const kept = trainedDays.size >= weekNeed(data)(start);
  const streak = weekStreaks(data, end).current;
  // Trained on days nothing else got ticked: a busy week, shown up anyway.
  const busy = [...trainedDays].filter((d) => !ticked.get(d)).length;
  return {
    week: { start, end },
    sessions: { done: trainedDays.size, planned: planned || null },
    workSets,
    mealDays,
    proteinDays,
    steps,
    sleepMin,
    kept,
    streak,
    trainedDespite: trainedDays.size ? busy >= 2 : null,
  };
}

/** Was anything done that week at all? A quiet week gets no card. */
export function hasWeek(stats) {
  return stats.sessions.done > 0 || stats.mealDays > 0 || stats.workSets > 0;
}

/** The one line at the bottom of the wrap-up. Never about what wasn't
 * done: a streak, else a kept week, else the sessions there were. */
export function identityLine(stats, t = tr) {
  if (stats.streak >= 2) return t('wrap.idStreak', { n: stats.streak });
  if (stats.kept) return t('wrap.idKept');
  if (stats.sessions.done > 0) return t(stats.sessions.done === 1 ? 'wrap.idShowedOne' : 'wrap.idShowed', { n: stats.sessions.done });
  return '';
}

/** "3 of 4 sessions · 46 sets", the card's one line. */
export function summaryLine(stats, t = tr) {
  const s = stats.sessions;
  const sessions = s.planned ? t('wrap.sessionsOf', { done: s.done, planned: s.planned }) : t('wrap.sessionsN', { n: s.done });
  return `${sessions} · ${t('wrap.setsN', { n: stats.workSets })}`;
}

/** The week a Sunday or Monday wrap-up is about, or null on other days. */
export function wrapWeek(today) {
  const thisWeek = weekStart(today);
  const day = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${thisWeek}T00:00:00Z`)) / 86400000);
  return day <= 1 ? addDays(thisWeek, -7) : null;
}

/** Should Home offer the wrap-up today? Sunday and Monday, for the week
 * that just ended, until dismissed; never in the first week after setup,
 * and never for a quiet week. */
export function wrapDue(data, content, today) {
  const week = wrapWeek(today);
  if (!week) return false;
  if (data?.settings?.wrapup_seen === week) return false;
  if (data?.setup?.done_on && data.setup.done_on > week) return false;
  return hasWeek(weekStats(data, content, week));
}

/** Dismiss this week's wrap-up. */
export function dismissWrap(data, today) {
  const week = wrapWeek(today);
  return week ? { ...data, settings: { ...data.settings, wrapup_seen: week } } : data;
}

/** The plain text for "Send my week": the person reads and edits it in
 * the share sheet and picks the chat. `check` is the About data check line. */
export function weekText(stats, { feel = '', check = '' } = {}, t = tr) {

  const s = stats.sessions;
  const lines = [
    t('wrap.textTitle', { from: dayMonth(stats.week.start), to: dayMonth(stats.week.end) }),
    `${t('wrap.rowSessions')}: ${s.planned ? t('wrap.ofN', { done: s.done, planned: s.planned }) : s.done}`,
    `${t('wrap.rowSets')}: ${stats.workSets}`,
    `${t('wrap.rowMealDays')}: ${stats.mealDays}`,
  ];
  if (stats.proteinDays != null) lines.push(`${t('wrap.rowProteinShort')}: ${stats.proteinDays}`);
  const how = String(feel || '').trim();
  if (how) lines.push(`${t('wrap.rowFelt')}: ${how}`);
  if (check) lines.push(`${t('wrap.rowCheck')}: ${check}`);
  return lines.join('\n');
}

/** The lines on the shared picture: effort only (no meals, no protein). */
export function pictureLines(stats, t = tr) {
  const s = stats.sessions;
  const lines = [
    { label: t('wrap.rowSessions'), value: s.planned ? t('wrap.ofN', { done: s.done, planned: s.planned }) : String(s.done) },
    { label: t('wrap.rowSets'), value: String(stats.workSets) },
  ];
  if (stats.streak > 0) lines.push({ label: t('wrap.rowStreak'), value: t('wrap.weeksN', { n: stats.streak }) });
  return lines;
}
