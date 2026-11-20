// One short tip on the full-screen rest timer (BeFit item 4). Plain advice
// for between sets, nothing medical. The same rest keeps the same tip; the
// next rest moves on. Pure; restTips.test.js.

export const REST_TIPS = [
  'timer.tip.breathe',
  'timer.tip.water',
  'timer.tip.setup',
  'timer.tip.tank',
  'timer.tip.shake',
  'timer.tip.long',
];

/** The tip's i18n key for a rest, from a number that stays the same for
 * that rest (its start time in seconds). */
export function restTip(seed) {
  const n = Math.abs(Math.floor(Number(seed) || 0));
  return REST_TIPS[n % REST_TIPS.length];
}
