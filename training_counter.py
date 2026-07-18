from sqlmodel import Session, select

from models import Workout


def count_training_sessions(session: Session) -> int:
    """Gym + Home sessions share one rotation counter so switching between
    them mid-week doesn't reset the Upper/Lower split. Padel and Recovery
    don't advance it."""
    return len(
        session.exec(select(Workout).where(Workout.workout_type.in_(["gym", "home"]))).all()
    )
