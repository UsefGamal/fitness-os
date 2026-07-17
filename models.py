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


class BodyLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    log_date: date
    weight_kg: float
    waist_cm: Optional[float] = None
    notes: Optional[str] = None


class Workout(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    log_date: date
    workout_type: str  # "gym" or "padel"
    duration_min: Optional[int] = None
    notes: Optional[str] = None


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


class MealLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    log_date: date
    meal_slot: str
    completed: bool = False


class ReminderLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    log_date: date
    reminder_type: str
    sent_at: datetime = Field(default_factory=datetime.utcnow)
