from datetime import date, timedelta

from sqlmodel import Session, select

from content.projections import week_start
from database import engine
from models import BodyLog, BonusLog, Profile, Workout
from quest_engine import _longest_streak_ever, sync_system_quests


def _points_by_key(db: Session) -> dict:
    rows = db.exec(select(BonusLog)).all()
    return {row.task_key: row.points for row in rows}


def test_first_5kg_milestone_auto_unlocks(client):
    today = date.today()
    with Session(engine) as db:
        profile = db.exec(select(Profile)).first()
        profile.start_weight_kg = 100
        db.add(profile)
        db.add(BodyLog(log_date=today, weight_kg=94.5))
        db.commit()

        sync_system_quests(db, today)
        points = _points_by_key(db)
        assert points.get("first_5kg") == 50


def test_first_5kg_not_awarded_before_threshold(client):
    today = date.today()
    with Session(engine) as db:
        profile = db.exec(select(Profile)).first()
        profile.start_weight_kg = 100
        db.add(profile)
        db.add(BodyLog(log_date=today, weight_kg=97))
        db.commit()

        sync_system_quests(db, today)
        points = _points_by_key(db)
        assert "first_5kg" not in points


def test_three_sessions_week_auto_unlocks_once(client):
    # Fixed reference date (a Thursday) so the 3-days-this-week setup below
    # never lands on a real Monday/Tuesday test run and falls short of a
    # full week's worth of days to place sessions on.
    today = date(2026, 1, 8)
    wk_start = week_start(today)
    with Session(engine) as db:
        for i in range(3):
            db.add(Workout(log_date=wk_start + timedelta(days=i), workout_type="home"))
        db.commit()

        sync_system_quests(db, today)
        points = _points_by_key(db)
        assert points.get("three_sessions_week") == 25

        # Calling again (e.g. a second page load same week) must not double-award.
        sync_system_quests(db, today)
        rows = db.exec(select(BonusLog).where(BonusLog.task_key == "three_sessions_week")).all()
        assert len(rows) == 1


def test_first_deload_auto_unlocks(client):
    today = date.today()
    with Session(engine) as db:
        db.add(Workout(log_date=today, workout_type="gym", is_deload=True))
        db.commit()

        sync_system_quests(db, today)
        points = _points_by_key(db)
        assert points.get("first_deload") == 30


def test_meal_prep_week_tracks_daily_habit_completion(client):
    """Weekly/once quests are meant to be driven by the daily habits
    themselves, not tracked separately — meal_prep_week should unlock once
    the 'meal_prep' daily habit has been logged every day so far this
    week."""
    today = date.today()
    wk_start = week_start(today)
    with Session(engine) as db:
        d = wk_start
        while d <= today:
            db.add(BonusLog(log_date=d, task_key="meal_prep", points=10))
            d += timedelta(days=1)
        db.commit()

        sync_system_quests(db, today)
        points = _points_by_key(db)
        assert points.get("meal_prep_week") == 20


def test_longest_streak_ever_ignores_gaps():
    d0 = date(2026, 1, 1)
    dates = {d0 + timedelta(days=i) for i in range(5)}  # 5-day run
    dates |= {d0 + timedelta(days=i) for i in range(10, 40)}  # 30-day run
    assert _longest_streak_ever(dates) == 30


def test_weekly_and_once_toggle_endpoint_rejected(auth_client):
    r = auth_client.post(
        "/bonus/toggle",
        data={"task_key": "three_sessions_week"},
        headers={"referer": "http://testserver/bonus"},
    )
    assert "error=" in str(r.url)
