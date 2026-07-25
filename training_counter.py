from datetime import date

from sqlmodel import Session, select

from models import Workout

DELOAD_REMINDER_WEEKS = 6


def count_training_sessions(session: Session) -> int:
    """Gym + Home sessions share one rotation counter so switching between
    them mid-week doesn't reset the Upper/Lower split. Padel and Recovery
    don't advance it."""
    return len(
        session.exec(select(Workout).where(Workout.workout_type.in_(["gym", "home"]))).all()
    )


def weeks_since_last_deload(session: Session, plan_start_date: date) -> int:
    """Weeks since the last gym/home session flagged as a deload, or since
    plan_start_date if none has been logged yet."""
    last_deload = session.exec(
        select(Workout)
        .where(Workout.workout_type.in_(["gym", "home"]), Workout.is_deload == True)  # noqa: E712
        .order_by(Workout.log_date.desc())
    ).first()
    since = last_deload.log_date if last_deload else plan_start_date
    return (date.today() - since).days // 7


def deload_due(session: Session, plan_start_date: date) -> bool:
    return weeks_since_last_deload(session, plan_start_date) >= DELOAD_REMINDER_WEEKS
