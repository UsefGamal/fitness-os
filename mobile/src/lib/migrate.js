// Versioned data and the one path that upgrades it (E2-S1, E2-S6, E2-S7).
//
// Every copy of the data, whether it comes from localStorage, the file
// mirror, a snapshot or an imported backup, goes through migrate(). Each
// step is a pure function from version n to n + 1, and running migrate()
// on data that is already current changes nothing, so it is safe to run on
// every start. Keys this app doesn't know are carried through untouched,
// so a backup from a newer build that only added a key still restores.
// Data from a newer schema than this app knows is refused rather than
// guessed at: "Update the app first".
//
// v1 is the original shape (the old site's "fitness-os-export" v1 and this
// app's own data until phase 11). v2 is the one planned schema bump: it
// adds every field the next phases need, so later phases don't change the
// shape again until the rewards ledger (v3, phase 17).

export const CURRENT_SCHEMA = 2;

export class NewerSchemaError extends Error {
  constructor(version) {
    super(`This data is from a newer version of the app (data version ${version}). Update the app first, then try again.`);
    this.version = version;
  }
}

/** The schema version of any copy: v2+ has schemaVersion, v1 had version. */
export function schemaOf(raw) {
  if (raw && Number.isInteger(raw.schemaVersion)) return raw.schemaVersion;
  if (raw && Number.isInteger(raw.version)) return raw.version;
  return 1;
}

export function needsMigration(raw) {
  return schemaOf(raw) < CURRENT_SCHEMA;
}

// Until v2, an empty profile meant these values (models.py's old Profile
// defaults, which were Yusuf's). v1 data that already computed targets
// from them keeps them, so its numbers don't move; new installs never get
// them.
export const V1_PROFILE_DEFAULTS = {
  height_cm: 173,
  date_of_birth: '1999-01-01',
  goal_weight_low_kg: 75,
  goal_weight_high_kg: 80,
  goal_date: '2027-01-18',
  start_weight_kg: null,
  gender: 'male',
  activity_level: 'moderate',
};

const GOAL_FIELDS = ['goal_weight_low_kg', 'goal_weight_high_kg', 'goal_date', 'start_weight_kg'];

/** Safety gates are flags only; the screening answers are never stored. */
export function defaultSafety() {
  return {
    screen_version: null,
    screened_on: null,
    gates: {
      no_deficit: false,
      no_fasting_deficit: false,
      needs_clearance: false,
      protein_cap: false,
      beginner_only: false,
    },
    hide_kcal: false,
    hide_weight: false,
  };
}

export function defaultDiet(planStartDate) {
  return { mode: 'plan', plan_start_date: planStartDate, ramadan: { from: null, to: null } };
}

/** The first plan block: the content's weekly plan, copied in so later
 * content changes can't rewrite a plan someone is already following. */
export function blockFromContent(content, { id = 'b1', startedOn, overrides = {} } = {}) {
  const T = content.training;
  return {
    id,
    template_id: 'ul-ppl',
    template_version: content.version ?? 1,
    started_on: startedOn,
    ended_on: null,
    schedule: T.trainer_plan.schedule.map((d) => ({ ...d })),
    sessions: structuredClone(T.program),
    overrides: structuredClone(overrides),
    deload_weeks: [],
  };
}

function hasV1History(raw) {
  return Boolean(raw.profile) || (Array.isArray(raw.body_logs) && raw.body_logs.length > 0);
}

function v1ToV2(raw, content) {
  const { version: _drop, plan_overrides: overrides, ...rest } = raw;
  const planStart = content.nutrition.plan_start_date;
  const out = { ...rest, schemaVersion: 2 };

  // Profile: body facts stay in profile, the goal moves to goals[]. Old
  // data keeps the old defaults it was already using (zero diff).
  const merged = hasV1History(raw) ? { ...V1_PROFILE_DEFAULTS, ...(raw.profile || {}) } : raw.profile || null;
  if (merged) {
    const profile = { ...merged };
    for (const k of GOAL_FIELDS) delete profile[k];
    out.profile = { ...profile, week_start: profile.week_start ?? 'sun', experience: profile.experience ?? null, locale: profile.locale ?? 'en', units: profile.units ?? 'kg' };
    out.goals = [{
      id: 'g1',
      set_on: planStart,
      direction: 'lose',
      start_weight_kg: merged.start_weight_kg ?? null,
      target_low_kg: merged.goal_weight_low_kg ?? null,
      target_high_kg: merged.goal_weight_high_kg ?? null,
      target_date: merged.goal_date ?? null,
      rate_pct_bw_wk: null,
      ended_on: null,
    }];
  } else {
    out.profile = null;
    out.goals = [];
  }

  out.safety = raw.safety ?? defaultSafety();
  out.diet = raw.diet ?? defaultDiet(planStart);
  out.program = raw.program ?? {
    schedule_mode: 'weekdays',
    active_block: 'b1',
    blocks: [blockFromContent(content, { startedOn: planStart, overrides: overrides && typeof overrides === 'object' ? overrides : {} })],
  };
  out.checkins = Array.isArray(raw.checkins) ? raw.checkins : [];
  out.rewards = raw.rewards ?? { ledger: [] };

  const blockId = out.program.active_block;
  out.workouts = (raw.workouts || []).map((w) => ({
    ...w,
    block_id: w.block_id ?? (w.session_key ? blockId : null),
    is_deload: w.is_deload ?? false,
    sets: (w.sets || []).map((s) => ({ ...s, rir: s.rir ?? null, is_warmup: s.is_warmup ?? false })),
  }));
  return out;
}

const STEPS = { 1: v1ToV2 };

/** Upgrade any copy to CURRENT_SCHEMA. Pure and idempotent. */
export function migrate(raw, content) {
  let version = schemaOf(raw);
  if (version > CURRENT_SCHEMA) throw new NewerSchemaError(version);
  let data = raw;
  while (version < CURRENT_SCHEMA) {
    data = STEPS[version](data, content);
    version += 1;
  }
  return data;
}
