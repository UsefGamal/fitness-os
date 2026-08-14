"""System-evaluated weekly quests and once-ever milestones.

Only "daily" bonus tasks (Today's Habits) are user-toggled — see
routers/bonus.py's toggle_bonus(). Weekly quests and once-ever milestones
are derived from real logged data (training sessions, body log, and the
daily habits themselves) so they can't be marked by hand; this module is
what turns a newly-true condition into a permanent BonusLog row worth its
points, at most once per week (weekly) or once ever (once).

Deliberately reuses the daily habit logs as an input to weekly/once
conditions (meal_prep_week, no_missed_week) — daily habit-marking is
meant to be the one thing the user does, and it should compound into the
bigger quests over time rather than being tracked twice.
"""

from datetime import date
from itertools import pairwise

from sqlmodel import Session, select

from content.bonus_tasks import BONUS_TASKS_BY_KEY
from content.projections import week_start as _week_start
from models import BodyLog, BonusLog, Profile, Workout

WEEKLY_KEYS = {k for k, t in BONUS_TASKS_BY_KEY.items() if t["frequency"] == "weekly"}
ONCE_KEYS = {k for k, t in BONUS_TASKS_BY_KEY.items() if t["frequency"] == "once"}


def _longest_streak_ever(workout_dates: set[date]) -> int:
    """Longest run of consecutive calendar days with at least one workout,
    anywhere in history — not just the streak ending today. Used for the
    'hit a 30-day streak, ever' milestone, which should stay earned even
    if the streak later breaks."""
    if not workout_dates:
        return 0
    ordered = sorted(workout_dates)
    best = run = 1
    for prev, curr in pairwise(ordered):
        run = run + 1 if (curr - prev).days == 1 else 1
        best = max(best, run)
    return best


def _weekly_conditions(session: Session, today: date) -> dict[str, bool]:
    week_start = _week_start(today)
    days_elapsed = (today - week_start).days + 1

    session_days = set(
        session.exec(
            select(Workout.log_date).where(Workout.log_date >= week_start, Workout.log_date <= today)
        ).all()
    )

    daily_logs_this_week = session.exec(
        select(BonusLog.log_date, BonusLog.task_key).where(
            BonusLog.log_date >= week_start, BonusLog.log_date <= today
        )
    ).all()
    checkin_days = {d for d, _key in daily_logs_this_week}
    meal_prep_days = {d for d, key in daily_logs_this_week if key == "meal_prep"}

    return {
        "three_sessions_week": len(session_days) >= 3,
        "no_missed_week": len(checkin_days) >= days_elapsed,
        "meal_prep_week": len(meal_prep_days) >= days_elapsed,
    }


def _once_conditions(session: Session, today: date) -> dict[str, bool]:
    profile = session.exec(select(Profile)).first()
    body_logs = session.exec(select(BodyLog).order_by(BodyLog.log_date)).all()

    lost_5kg = False
    if body_logs:
        start_weight = (profile.start_weight_kg if profile else None) or body_logs[0].weight_kg
        lowest = min(log.weight_kg for log in body_logs)
        lost_5kg = (start_weight - lowest) >= 5

    workout_dates = set(session.exec(select(Workout.log_date)).all())
    streak_30 = _longest_streak_ever(workout_dates) >= 30

    had_deload = (
        session.exec(select(Workout).where(Workout.is_deload == True)).first() is not None  # noqa: E712
    )

    return {
        "first_5kg": lost_5kg,
        "thirty_day_streak": streak_30,
        "first_deload": had_deload,
    }


def sync_system_quests(session: Session, today: date) -> None:
    """Idempotent — safe to call on every /bonus or dashboard load. Awards
    points (by inserting a BonusLog row) for any weekly/once quest whose
    condition just became true and hasn't already been recorded."""
    week_start = _week_start(today)

    weekly_met = {k for k, met in _weekly_conditions(session, today).items() if met}
    if weekly_met:
        already_this_week = set(
            session.exec(
                select(BonusLog.task_key).where(
                    BonusLog.log_date >= week_start, BonusLog.task_key.in_(list(weekly_met))
                )
            ).all()
        )
        for key in weekly_met - already_this_week:
            task = BONUS_TASKS_BY_KEY[key]
            session.add(BonusLog(log_date=today, task_key=key, points=task["points"]))

    once_met = {k for k, met in _once_conditions(session, today).items() if met}
    if once_met:
        already_ever = set(
            session.exec(select(BonusLog.task_key).where(BonusLog.task_key.in_(list(once_met)))).all()
        )
        for key in once_met - already_ever:
            task = BONUS_TASKS_BY_KEY[key]
            session.add(BonusLog(log_date=today, task_key=key, points=task["points"]))

    if weekly_met or once_met:
        session.commit()
