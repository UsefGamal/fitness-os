from datetime import date

from sqlmodel import Session, select

from content.projections import linear_rate_kg_per_week, predicted_goal_date, target_rate_kg_per_week
from models import BodyLog, Profile
from routers.meals import PLAN_START_DATE


def get_baseline(session: Session, today: date = None) -> dict:
    """Shared baseline projection numbers used by both the dashboard and the
    what-if simulator, so they never drift out of sync with each other."""
    today = today or date.today()
    profile = session.exec(select(Profile)).first()
    body_logs = session.exec(select(BodyLog).order_by(BodyLog.log_date)).all()

    current_weight = body_logs[-1].weight_kg if body_logs else None
    start_weight = profile.start_weight_kg or (body_logs[0].weight_kg if body_logs else None)
    goal_mid = (profile.goal_weight_low_kg + profile.goal_weight_high_kg) / 2

    recent_logs = [log for log in body_logs if (today - log.log_date).days <= 90]
    actual_rate = linear_rate_kg_per_week(recent_logs)
    target_rate = (
        target_rate_kg_per_week(start_weight, goal_mid, PLAN_START_DATE, profile.goal_date)
        if start_weight is not None
        else None
    )
    baseline_date = (
        predicted_goal_date(current_weight, goal_mid, actual_rate, today)
        if current_weight is not None
        else None
    )

    return {
        "profile": profile,
        "current_weight": current_weight,
        "start_weight": start_weight,
        "goal_mid": goal_mid,
        "actual_rate": actual_rate,
        "target_rate": target_rate,
        "baseline_date": baseline_date,
        "today": today,
    }
