from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Profile(SQLModel, table=True):
    """Single-row table holding the user's current stats and goal."""

    id: Optional[int] = Field(default=None, primary_key=True)
    height_cm: float = 173
    date_of_birth: date = date(1999, 1, 1)
    goal_weight_low_kg: float = 75
    goal_weight_high_kg: float = 80
    goal_date: date = date(2027, 1, 18)
    due_date: Optional[date] = date(2026, 11, 18)
    activity_notes: str = "Data engineer, desk job. Padel 2x/week (1.5h)."
    fitness_level: str = "intermediate"
    start_weight_kg: Optional[float] = None


class BodyLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    log_date: date
    weight_kg: float
    waist_cm: Optional[float] = None
    notes: Optional[str] = None
    sleep_hours: Optional[float] = None
    chest_cm: Optional[float] = None
    arm_cm: Optional[float] = None
    hips_cm: Optional[float] = None
    thigh_cm: Optional[float] = None


class HydrationLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    log_date: date
    ml: int = 0


class Workout(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    log_date: date
    workout_type: str  # "gym" or "padel"
    duration_min: Optional[int] = None
    notes: Optional[str] = None
    session_rpe: Optional[int] = None  # 1-10 session-level intensity/effort
    is_deload: bool = False
    pain_note: Optional[str] = None


class Exercise(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    muscle_group: str
    equipment: Optional[str] = None


class WorkoutSet(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    workout_id: int = Field(foreign_key="workout.id")
    exercise_id: int = Field(foreign_key="exercise.id")
    set_number: int
    reps: int
    weight_kg: float
    rpe: Optional[float] = None  # 1-10 perceived effort for this set


class ChecklistItemLog(SQLModel, table=True):
    """Used by Home (bodyweight) and Recovery sessions — lighter-weight than
    WorkoutSet since there's no external load to log, just completion and
    (for Home) reps achieved for progression suggestions."""

    id: Optional[int] = Field(default=None, primary_key=True)
    workout_id: int = Field(foreign_key="workout.id")
    item_name: str
    completed: bool = False
    reps_achieved: Optional[int] = None


class MealLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    log_date: date
    meal_slot: str
    completed: bool = False
    option_key: Optional[str] = None  # "option_a" or "option_b" — which one was eaten
    drink_key: Optional[str] = None  # which drink (see content/food_items.DRINKS) was chosen


class BonusLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    log_date: date
    task_key: str
    points: int


class ReminderLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    log_date: date
    reminder_type: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
