// Home shows at most one of these cards under the session card (WRAP-1),
// in this order: the doctor note (safety), welcome back (BACK-1), the
// goal reached (MAINT-1), the target check (TARGET-1), the first week (FIRST-1), the Sunday wrap-up, the recovery-week suggestion. Pure; homeCard.test.js.
import { recoveryDue } from './recovery.js';
import { showClearance } from './safety.js';
import { wrapDue } from './weekStats.js';

/** 'clearance' | 'back' | 'goal' | 'target' | 'first' | 'wrapup' | 'recovery' | null.
 * `back`: BACK-1's welcome-back card is due; `goal`: the goal is reached
 * and maintenance not started; `target`: the weekly target check is due;
 * `first`: the first-week card is due. */
export function homeCard(data, content, today, { back = false, goal = false, target = false, first = false } = {}) {
  if (showClearance(data, today)) return 'clearance';
  if (back) return 'back';
  if (goal) return 'goal';
  if (target) return 'target';
  if (first) return 'first';
  if (wrapDue(data, content, today)) return 'wrapup';
  if (recoveryDue(data, today)) return 'recovery';
  return null;
}
