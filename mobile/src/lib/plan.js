// The one place that says which plan is running (E4-S1).
//
// Everything that asks "what's on today?", "what's in this session?" or
// "what did I change?" goes through activePlan(), never straight to
// content.training. From v2 the plan someone follows is a block in
// data.program.blocks with its own copy of the sessions and weekly
// schedule, so a later change to content/ can't quietly rewrite it. Data
// without a block (not yet migrated, or a test) falls back to the content.

export function activeBlock(data) {
  const program = data?.program;
  if (!program || !Array.isArray(program.blocks) || !program.blocks.length) return null;
  return program.blocks.find((b) => b.id === program.active_block) || program.blocks.find((b) => !b.ended_on) || null;
}

/** content.training, with the active block's sessions and weekly schedule. */
export function activePlan(data, content) {
  const T = content.training;
  const block = activeBlock(data);
  if (!block) return T;
  return {
    ...T,
    program: block.sessions || T.program,
    trainer_plan: { ...T.trainer_plan, name: block.name || T.trainer_plan.name, schedule: block.schedule || T.trainer_plan.schedule },
  };
}

/** The edits made to the running plan: { sessionKey: [exercise rows] }. */
export function planOverrides(data) {
  const block = activeBlock(data);
  if (block) return block.overrides || {};
  return data?.plan_overrides || {};
}

/** Store edits on the active block (or the v1 key when there is none). */
export function withPlanOverrides(data, overrides) {
  const block = activeBlock(data);
  if (!block) return { ...data, plan_overrides: overrides };
  return {
    ...data,
    program: {
      ...data.program,
      blocks: data.program.blocks.map((b) => (b === block ? { ...b, overrides } : b)),
    },
  };
}

// ── The weekly plan: which session goes on each weekday ─────────────────

/** The week the running block started from: its ready-made routine's
 * (content.training.routines), else the build's own plan. */
export function templateSchedule(block, content) {
  const T = content.training;
  const routine = block && (T.routines || []).find((r) => r.id === block.template_id);
  return routine ? routine.schedule : T.trainer_plan.schedule;
}

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Put `session` (a session key or 'rest') on `day` ('monday') every week.
 * Lives on the active block, so it survives updates. A change that would
 * leave no training day at all is refused (returns `data` unchanged). */
export function setWeekday(data, content, day, session) {
  const block = activeBlock(data);
  if (!block || !WEEKDAYS.includes(day)) return data;
  const current = block.schedule || templateSchedule(block, content);
  const schedule = WEEKDAYS.map((d) => {
    const entry = current.find((e) => e.day === d) || { day: d, plan_day: WEEKDAYS.indexOf(d) + 1, session: 'rest', cardio_after: null };
    return d === day ? { ...entry, session } : { ...entry };
  });
  if (schedule.every((e) => e.session === 'rest')) return data;
  return {
    ...data,
    program: { ...data.program, blocks: data.program.blocks.map((b) => (b === block ? { ...b, schedule } : b)) },
  };
}

/** The weekly plan back to the template's. */
export function resetWeek(data, content) {
  const block = activeBlock(data);
  if (!block) return data;
  const schedule = templateSchedule(block, content).map((d) => ({ ...d }));
  return {
    ...data,
    program: { ...data.program, blocks: data.program.blocks.map((b) => (b === block ? { ...b, schedule } : b)) },
  };
}

/** True when the weekly plan differs from the template's. */
export function isWeekEdited(data, content) {
  const block = activeBlock(data);
  if (!block?.schedule) return false;
  const base = templateSchedule(block, content);
  return WEEKDAYS.some((d) => (block.schedule.find((e) => e.day === d)?.session ?? 'rest') !== (base.find((e) => e.day === d)?.session ?? 'rest'));
}
