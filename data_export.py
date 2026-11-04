"""Everything Yusuf has logged, as one JSON document.

Used by Settings > "Download my data" and by scripts/export_data.py, so
the logs can move out of the Neon database: into the standalone phone app
(phase 3 imports this file), or just as a backup. Only user-entered data
is included. Plan content lives in content/, and sync/reminder/push
bookkeeping is server-only."""

from datetime import date, datetime

from sqlmodel import Session, SQLModel, select

from models import BodyLog, BonusLog, ChecklistItemLog, Exercise, HydrationLog, MealLog, Profile, Workout, WorkoutSet

EXPORT_FORMAT = "fitness-os-export"
EXPORT_VERSION = 1


def _row(obj: SQLModel) -> dict:
    out = {}
    for key, value in obj.model_dump().items():
        out[key] = value.isoformat() if isinstance(value, (date, datetime)) else value
    return out


def build_export(session: Session, now: datetime | None = None) -> dict:
    exercises = session.exec(select(Exercise).order_by(Exercise.id)).all()
    sets_by_workout: dict[int, list[dict]] = {}
    for s in session.exec(select(WorkoutSet).order_by(WorkoutSet.workout_id, WorkoutSet.set_number, WorkoutSet.id)).all():
        sets_by_workout.setdefault(s.workout_id, []).append(_row(s))
    items_by_workout: dict[int, list[dict]] = {}
    for item in session.exec(select(ChecklistItemLog).order_by(ChecklistItemLog.id)).all():
        items_by_workout.setdefault(item.workout_id, []).append(_row(item))

    workouts = []
    for w in session.exec(select(Workout).order_by(Workout.log_date, Workout.id)).all():
        workouts.append({**_row(w), "sets": sets_by_workout.get(w.id, []), "checklist_items": items_by_workout.get(w.id, [])})

    profile = session.exec(select(Profile)).first()
    return {
        "format": EXPORT_FORMAT,
        "version": EXPORT_VERSION,
        "exported_at": (now or datetime.utcnow()).replace(microsecond=0).isoformat() + "Z",
        "profile": _row(profile) if profile else None,
        "exercises": [_row(e) for e in exercises],
        "body_logs": [_row(r) for r in session.exec(select(BodyLog).order_by(BodyLog.log_date, BodyLog.id)).all()],
        "hydration_logs": [
            _row(r) for r in session.exec(select(HydrationLog).order_by(HydrationLog.log_date, HydrationLog.id)).all()
        ],
        "workouts": workouts,
        "meal_logs": [_row(r) for r in session.exec(select(MealLog).order_by(MealLog.log_date, MealLog.id)).all()],
        "bonus_logs": [_row(r) for r in session.exec(select(BonusLog).order_by(BonusLog.log_date, BonusLog.id)).all()],
    }
