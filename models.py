from datetime import date, datetime

from sqlmodel import Field, SQLModel


class Profile(SQLModel, table=True):
    """Single-row table holding the user's current stats and goal."""

    id: int | None = Field(default=None, primary_key=True)
    height_cm: float = 173
    date_of_birth: date = date(1999, 1, 1)
    goal_weight_low_kg: float = 75
    goal_weight_high_kg: float = 80
    goal_date: date = date(2027, 1, 18)
    activity_notes: str = "Data engineer, desk job. Padel 2x/week (1.5h)."
    fitness_level: str = "intermediate"
    start_weight_kg: float | None = None
    gender: str = "male"  # Mifflin-St Jeor input (see content/tdee.py) — no neutral default exists for this formula
    activity_level: str = "moderate"  # TDEE multiplier tier (see content/tdee.py's ACTIVITY_MULTIPLIERS)


class BodyLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    log_date: date
    weight_kg: float
    waist_cm: float | None = None
    notes: str | None = None
    sleep_hours: float | None = None
    chest_cm: float | None = None
    arm_cm: float | None = None
    hips_cm: float | None = None
    thigh_cm: float | None = None


class HydrationLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    log_date: date
    ml: int = 0


class Workout(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    log_date: date
    workout_type: str  # "gym" or "padel"
    duration_min: int | None = None
    notes: str | None = None
    session_rpe: int | None = None  # 1-10 session-level intensity/effort
    is_deload: bool = False
    pain_note: str | None = None
    result: str | None = None  # "win" / "loss" / "draw" — used by padel


class Exercise(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    muscle_group: str
    equipment: str | None = None


class WorkoutSet(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    workout_id: int = Field(foreign_key="workout.id")
    exercise_id: int = Field(foreign_key="exercise.id")
    set_number: int
    reps: int
    weight_kg: float
    rpe: float | None = None  # 1-10 perceived effort for this set


class ChecklistItemLog(SQLModel, table=True):
    """Used by Home (bodyweight) and Recovery sessions — lighter-weight than
    WorkoutSet since there's no external load to log, just completion and
    (for Home) reps achieved for progression suggestions."""

    id: int | None = Field(default=None, primary_key=True)
    workout_id: int = Field(foreign_key="workout.id")
    item_name: str
    completed: bool = False
    reps_achieved: int | None = None


class MealLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    log_date: date
    meal_slot: str
    completed: bool = False
    option_key: str | None = None  # "option_a" / "option_b", or "option_c" (the static-plan fallback shown alongside a synced plan) — which one was eaten
    drink_key: str | None = None  # which drink (see content/food_items.DRINKS) was chosen


class BonusLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    log_date: date
    task_key: str
    points: int


class ReminderLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    log_date: date
    reminder_type: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    # "sent" | "error" — the digest cron routes queue a background task and
    # respond immediately (see reminders.py), so this is the only record of
    # whether the email actually went out. An "error" row doesn't count as
    # already-sent for the day, so the next cron ping retries automatically.
    status: str = "sent"
    error_detail: str | None = None


class MealPlanSync(SQLModel, table=True):
    """One row per FitChef sync attempt. A sync covers two chained weekly
    generations (14 days total) — status walks week1_pending ->
    week2_pending -> complete (or -> error at either step). Only the most
    recent 'complete' row is ever read for meal content (see
    fitchef_sync.get_active_day); older rows are kept only as history."""

    id: int | None = Field(default=None, primary_key=True)
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None
    status: str = "week1_pending"  # week1_pending | week2_pending | complete | error
    week1_identifier: int | None = None
    week2_identifier: int | None = None
    recipe_history: str | None = None  # JSON string, chained into the next sync
    week1_json: str | None = None  # raw week1 payload, held until week2 completes
    plan_json: str | None = None  # final merged 14-day plan, set once complete
    products_json: str | None = None  # merged shopping-list products, set once complete
    error_detail: str | None = None


class EdamamPlanSync(SQLModel, table=True):
    """One row per Edamam sync. Recipe Search's real per-account rate
    limit turned out to be much tighter and less predictable than
    documented (isolated calls succeed instantly; calls even 15-20s apart
    still sometimes 429) — retries with backoff are necessary and can
    make a sync take a couple of minutes, so this runs as a FastAPI
    background task rather than blocking the request/response cycle.
    status walks pending -> complete (or -> error). Only the most recent
    'complete' row is read for meal content (see
    edamam_sync.get_active_day); older rows are kept only as history."""

    id: int | None = Field(default=None, primary_key=True)
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    synced_at: datetime | None = None
    status: str = "pending"  # pending | complete | error
    plan_json: str | None = None
    products_json: str | None = None
    error_detail: str | None = None
