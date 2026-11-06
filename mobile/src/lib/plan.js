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
