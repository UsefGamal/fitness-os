// Hold a +/- button to keep stepping (E4-S10): a short wait so a tap stays
// one step, then steady repeats that speed up on a long hold.
export const HOLD = { startMs: 400, slowMs: 130, fastMs: 60, fastAfter: 8 };

/** The wait before repeat number n (0 = the first repeat after pressing). */
export function holdDelay(n, cfg = HOLD) {
  if (n <= 0) return cfg.startMs;
  return n < cfg.fastAfter ? cfg.slowMs : cfg.fastMs;
}

/** One step of a stepper: clamp to [min, max] and round to `decimals`. */
export function stepValue(value, delta, { min = 0, max = 1000, decimals = 0 } = {}) {
  const v = (Number.isFinite(value) ? value : 0) + delta;
  return Number(Math.min(max, Math.max(min, v)).toFixed(decimals));
}
