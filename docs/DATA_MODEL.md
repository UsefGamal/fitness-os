# Data model

All tables are defined in `models.py` (SQLModel — SQLAlchemy + Pydantic). SQLite locally, Postgres (Neon) in production. New columns on existing tables go through `database.py`'s `_LIGHT_MIGRATIONS` (see the README's [Migrations](../README.md#migrations) section) — `create_all()` alone won't add them.

## Relationships at a glance

```
Profile (single row, no FK — always exactly one)

Workout ──┬──< WorkoutSet >── Exercise
          └──< ChecklistItemLog

BodyLog, HydrationLog, MealLog, BonusLog, ReminderLog — all standalone,
keyed by log_date (no FKs; one logical "row per day" per concern)
```

## `Profile`

Single-row table (seeded once at startup if empty) holding the user's current stats and goal.

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | `int` | PK | |
| `height_cm` | `float` | `173` | |
| `date_of_birth` | `date` | `1999-01-01` | |
| `goal_weight_low_kg` | `float` | `75` | required in Settings |
| `goal_weight_high_kg` | `float` | `80` | required in Settings |
| `goal_date` | `date` | `2027-01-18` | required in Settings |
| `activity_notes` | `str` | "Data engineer, desk job..." | optional, no calculation impact |
| `fitness_level` | `str` | `"intermediate"` | `beginner` / `intermediate` / `advanced` |
| `start_weight_kg` | `Optional[float]` | `None` | **functionally required** — feeds `target_rate_kg_per_week()`; the Settings form marks it `required` even though the column is nullable (falls back to the first `BodyLog` entry if unset — see `baseline.py`) |

## `BodyLog`

One row per day a weigh-in/measurement was logged (upsert-by-date in `routers/body.py`).

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | `int` | PK | |
| `log_date` | `date` | — | |
| `weight_kg` | `float` | — | required |
| `waist_cm` | `Optional[float]` | `None` | |
| `notes` | `Optional[str]` | `None` | |
| `sleep_hours` | `Optional[float]` | `None` | |
| `chest_cm` | `Optional[float]` | `None` | |
| `arm_cm` | `Optional[float]` | `None` | |
| `hips_cm` | `Optional[float]` | `None` | |
| `thigh_cm` | `Optional[float]` | `None` | |

## `Workout`

One row per logged session, any type. `workout_type` is a free string (no enum/FK), currently one of `gym` / `home` / `recovery` / `cardio` / `padel`.

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | `int` | PK | |
| `log_date` | `date` | — | |
| `workout_type` | `str` | — | `gym`/`home`/`recovery`/`cardio`/`padel` |
| `duration_min` | `Optional[int]` | `None` | |
| `notes` | `Optional[str]` | `None` | gym/home: auto-filled with the program day label (e.g. "Upper A") if left blank — this is how `program_checklist` is matched back to a session |
| `session_rpe` | `Optional[int]` | `None` | 1-10, session-level effort — used by home/recovery/cardio/padel; gym also has per-set RPE on `WorkoutSet` |
| `is_deload` | `bool` | `False` | gym/home only; drives the "N weeks since your last deload" banner (`training_counter.deload_due`) |
| `pain_note` | `Optional[str]` | `None` | free text; aggregated into the dashboard's cross-training pain-pattern flag (3+ of last 5 sessions) |
| `result` | `Optional[str]` | `None` | `win`/`loss`/`draw` — padel only, drives the W-L-D record on `/padel` |

`training_counter.count_training_sessions()` counts only `workout_type in ("gym", "home")` — this is the shared rotation counter, so alternating gym/home days doesn't reset the Upper/Lower split. `recovery`, `cardio`, and `padel` never advance it.

## `Exercise`

Seeded at startup from `content/gym_exercises.SEED_EXERCISES` (idempotent — only inserts names not already present, so adding new seed exercises later is safe).

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | PK |
| `name` | `str` | e.g. "Back Squat" — matched by name against `content/gym_program.py` day specs |
| `muscle_group` | `str` | one of `Legs`/`Chest`/`Back`/`Shoulders`/`Arms`/`Core` — drives the body-map highlight and same-group "alternatives" lookup |
| `equipment` | `Optional[str]` | `Barbell`/`Machine`/`Dumbbell`/`Bodyweight`/`Cable` |

## `WorkoutSet`

One row per logged set (gym only — `Home`/`Recovery` use `ChecklistItemLog` instead, since there's no external load).

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | PK |
| `workout_id` | `int` | FK → `Workout.id` |
| `exercise_id` | `int` | FK → `Exercise.id` |
| `set_number` | `int` | 1-indexed within the session |
| `reps` | `int` | |
| `weight_kg` | `float` | |
| `rpe` | `Optional[float]` | 1-10, feeds `_suggest_next_weight()`'s autoregulation and the `/gym/progress` RPE trend |

## `ChecklistItemLog`

One row per checklist item per session, shared by Home (bodyweight) and Recovery.

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | PK |
| `workout_id` | `int` | FK → `Workout.id` |
| `item_name` | `str` | matches an exercise name (Home) or a `RECOVERY_CHECKLIST` string (Recovery) |
| `completed` | `bool` | default `False` |
| `reps_achieved` | `Optional[int]` | Home only — feeds the "last: N on DATE" progression hint |

## `MealLog`

One row per `(log_date, meal_slot)` — upserted, so completing/switching an option updates the same row rather than inserting a new one.

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | PK |
| `log_date` | `date` | |
| `meal_slot` | `str` | `breakfast`/`snack1`/`lunch`/`snack2`/`dinner` |
| `completed` | `bool` | default `False` |
| `option_key` | `Optional[str]` | `option_a` or `option_b` — which of the two meal options was eaten. The actual food composition is looked up deterministically from `content/meal_plan.py` by `(log_date, meal_slot, option_key)`; this table never stores food data itself |
| `drink_key` | `Optional[str]` | which drink (see `content/food_items.DRINKS`) — independent of `completed`, can be set before/without marking the meal eaten |

## `HydrationLog`

One row per day, running total in ml.

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | PK |
| `log_date` | `date` | |
| `ml` | `int` | default `0`; incremented via quick-add buttons (`POST /meals/hydration`), never overwritten |

## `BonusLog`

One row per completed bonus "quest" per day.

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | PK |
| `log_date` | `date` | |
| `task_key` | `str` | matches a `content/bonus_tasks.BONUS_TASKS` key |
| `points` | `int` | copied from the task definition at completion time (not looked up live), so past points stay stable even if `BONUS_TASKS` point values change later |

Total points = `SUM(points)` across all rows, all-time. Level = `1 + total_points // 50`. Badge tier = highest `content/milestones.MILESTONES` threshold reached.

## `ReminderLog`

Dedup guard *and* outcome record for the two cron email jobs. The `/cron/*` routes respond immediately (`{"status": "queued"}`) and do the actual digest-building + email-sending in a background task (see [sync-job-pattern](../.claude/skills/sync-job-pattern/SKILL.md)) — this row is the only record of whether that background attempt actually succeeded, surfaced on `/more`.

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | PK |
| `log_date` | `date` | |
| `reminder_type` | `str` | `daily_digest` or `weekly_recap` |
| `sent_at` | `datetime` | `default_factory=datetime.utcnow` — written when the attempt finishes, not when it was queued |
| `status` | `str` | `sent` or `error`; default `sent` (existing pre-migration rows were only ever written on success) |
| `error_detail` | `Optional[str]` | set only when `status == "error"` — shown on `/more` |

A row only counts as "already sent" (blocking a same-day retry without `force=true`) when `status == "sent"` — an `error` row lets the very next cron ping retry automatically.

## `MealPlanSync`

One row per FitChef sync attempt (secondary meal-plan source). A sync covers two chained weekly generations (14 days total) — `status` walks `week1_pending` → `week2_pending` → `complete` (or → `error` at either step). Only the most recent `complete` row is ever read for meal content (`fitchef_sync.get_active_day()`); older rows are kept only as history.

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | PK |
| `requested_at` | `datetime` | `default_factory=datetime.utcnow` |
| `completed_at` | `Optional[datetime]` | set once `status == "complete"` |
| `status` | `str` | `week1_pending` / `week2_pending` / `complete` / `error` |
| `week1_identifier` | `Optional[int]` | FitChef's identifier for the week-1 generation request |
| `week2_identifier` | `Optional[int]` | FitChef's identifier for the week-2 generation request, chained from week 1's `recipeHistory` |
| `recipe_history` | `Optional[str]` | JSON string, chained into the next sync so weeks 1 and 2 don't repeat recipes |
| `week1_json` | `Optional[str]` | raw week-1 payload, held only until week 2 completes, then cleared |
| `plan_json` | `Optional[str]` | final merged 14-day plan, set once `complete` |
| `products_json` | `Optional[str]` | merged shopping-list products, set once `complete` |
| `error_detail` | `Optional[str]` | set only on `error` |

## `EdamamPlanSync`

One row per Edamam sync attempt (primary meal-plan source). `status` walks `pending` → `complete` (or → `error`) as a background task — see [sync-job-pattern](../.claude/skills/sync-job-pattern/SKILL.md) for why. Only the most recent `complete` row is read for meal content (`edamam_sync.get_active_day()`); older rows are kept only as history.

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | PK |
| `requested_at` | `datetime` | `default_factory=datetime.utcnow` |
| `synced_at` | `Optional[datetime]` | set once `status == "complete"` |
| `status` | `str` | `pending` / `complete` / `error` |
| `plan_json` | `Optional[str]` | final 14-day plan, set once `complete` |
| `products_json` | `Optional[str]` | shopping-list products (aggregated by Edamam's `foodId`), set once `complete` |
| `error_detail` | `Optional[str]` | set only on `error` |

`edamam_sync.is_pending_stale()` treats a `pending` row older than `PENDING_TIMEOUT_MINUTES` (10) as dead — a background task has no durability guarantee across a server restart mid-sync — so a stuck row doesn't block every future sync attempt forever.
