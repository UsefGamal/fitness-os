// One interrupt at a time on Home (design laws plan #4). At 7 AM the
// session and its Start button come first: What's new waits as a thin line
// until the session is done (or no session is due), and Home shows one thin
// line at most. Pure helpers, tested in interrupts.test.js.

/** How What's new shows: 'sheet' (opens by itself), 'line' (a thin line to
 * tap while today's session is still due), or null (nothing new). */
export function whatsNewMode({ hasNews, sessionDue }) {
  if (!hasNews) return null;
  return sessionDue ? 'line' : 'sheet';
}

/** The one thin line under the weight card: 'news' before 'backup'. The
 * backup line also stays away while the first-week card already asks for a
 * backup, so the same ask never shows twice. */
export function homeLine({ news, backup, firstWeekAsksBackup }) {
  if (news) return 'news';
  if (backup && !firstWeekAsksBackup) return 'backup';
  return null;
}

/** Home's order under the plan card (design laws plan #11): on a training
 * day the Today ticks come before the weight, on a rest day the weight
 * leads. 'today' | 'weight'. */
export function homeOrder({ trainingDay }) {
  return trainingDay ? 'today' : 'weight';
}
