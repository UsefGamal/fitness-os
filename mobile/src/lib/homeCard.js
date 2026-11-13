// Home shows at most one of these cards under the session card (WRAP-1),
// in this order: the doctor note (safety), welcome back (BACK-1), the
// Sunday wrap-up, the recovery-week suggestion. Pure; homeCard.test.js.
import { recoveryDue } from './recovery.js';
import { showClearance } from './safety.js';
import { wrapDue } from './weekStats.js';

/** 'clearance' | 'back' | 'wrapup' | 'recovery' | null. `back`: BACK-1's
 * welcome-back card is due. */
export function homeCard(data, content, today, { back = false } = {}) {
  if (showClearance(data, today)) return 'clearance';
  if (back) return 'back';
  if (wrapDue(data, content, today)) return 'wrapup';
  if (recoveryDue(data, today)) return 'recovery';
  return null;
}
