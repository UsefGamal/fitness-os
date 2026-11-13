// The shape of the data file (the person's only copy), for the JSDoc type
// check on src/lib (`npm run typecheck`). Types only: nothing here ships in
// the app. Fields are the ones the helpers read; anything else on a row is
// allowed, because older and newer versions of the file must stay readable
// (lib/migrate.js, lib/dataFile.js).
//
// Use from a helper:
//   /** @param {import('../types').Data} data */

/** A calendar day as 'YYYY-MM-DD' in the phone's own time zone. */
export type ISODate = string;

export interface WorkoutSet {
  id: number;
  exercise_id: number;
  weight_kg?: number | null;
  reps?: number | null;
  /** 'warmup' sets never count as work sets (lib/data.js isWorkSet). */
  kind?: string;
  rir?: number | null;
  [key: string]: unknown;
}

export interface Workout {
  id: number;
  log_date: ISODate;
  workout_type?: string;
  /** The session's name. */
  notes?: string | null;
  sets: WorkoutSet[];
  checklist_items?: unknown[];
  [key: string]: unknown;
}

export interface Exercise {
  id: number;
  name: string;
  muscle_group: string;
  equipment?: string | null;
  custom?: boolean;
  [key: string]: unknown;
}

export interface BodyLog {
  log_date: ISODate;
  weight_kg?: number | null;
  [key: string]: unknown;
}

export interface Goal {
  id?: string;
  set_on?: ISODate;
  direction?: 'lose' | 'gain' | 'maintain' | 'recomp';
  start_weight_kg?: number | null;
  target_low_kg?: number | null;
  target_high_kg?: number | null;
  target_date?: ISODate | null;
  ended_on?: ISODate | null;
  [key: string]: unknown;
}

export interface ProgramBlock {
  id: string;
  [key: string]: any;
}

export interface Program {
  schedule_mode: string;
  active_block: string;
  blocks: ProgramBlock[];
  [key: string]: unknown;
}

export interface Settings {
  notifications?: boolean;
  modules?: Record<string, boolean>;
  training?: Record<string, any>;
  health?: { enabled?: boolean; [key: string]: unknown };
  water_goal_ml?: number;
  whats_new_seen?: string;
  [key: string]: any;
}

export interface MealLog {
  log_date: ISODate;
  /** The meal's numbers, copied when it was ticked (DA-1). */
  eaten?: { kcal: number; protein: number; carbs: number; fat: number; fiber: number } | null;
  [key: string]: any;
}

export interface Data {
  schemaVersion: number;
  saved_at?: string;
  profile: Record<string, any> | null;
  goals: Goal[];
  safety?: Record<string, any>;
  diet?: Record<string, any>;
  program?: Program;
  checkins?: any[];
  rewards?: { ledger: any[]; [key: string]: unknown };
  exercises: Exercise[];
  body_logs: BodyLog[];
  hydration_logs: any[];
  workouts: Workout[];
  meal_logs: MealLog[];
  bonus_logs: any[];
  shopping: { week: string | null; checked: any[] };
  settings: Settings;
  my_foods?: any[];
  progress_photos?: any[];
  health_daily?: any[];
  /** Keys a newer version wrote that this one doesn't know; kept, never dropped. */
  _unknown?: Record<string, unknown>;
  [key: string]: any;
}

// Baked in at build time by vite.config.js (lib/version.js).
declare global {
  const __APP_VERSION__: string;
  const __APP_BUILD__: string;
  const __RELEASE__: boolean;
  const __FLAVOR__: string;
}
