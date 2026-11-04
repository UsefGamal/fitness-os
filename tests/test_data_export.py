import json
from datetime import date

from sqlmodel import Session, select

from data_export import EXPORT_FORMAT, build_export
from database import engine
from models import BodyLog, Exercise, MealLog, Workout, WorkoutSet


def test_export_requires_login(client):
    response = client.get("/settings/export.json", follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"] == "/login"


def test_export_downloads_everything_logged(auth_client):
    with Session(engine) as db:
        exercise_id = db.exec(select(Exercise)).first().id
        workout = Workout(log_date=date(2026, 10, 29), workout_type="gym", notes="Pull", duration_min=60)
        db.add(workout)
        db.add(BodyLog(log_date=date(2026, 10, 29), weight_kg=82.4, waist_cm=88))
        db.add(MealLog(log_date=date(2026, 10, 29), meal_slot="breakfast", completed=True, option_key="option_a"))
        db.commit()
        db.refresh(workout)
        db.add(WorkoutSet(workout_id=workout.id, exercise_id=exercise_id, set_number=1, reps=10, weight_kg=60, rpe=8))
        db.commit()

    response = auth_client.get("/settings/export.json")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert "attachment" in response.headers["content-disposition"]
    data = json.loads(response.text)
    assert data["format"] == EXPORT_FORMAT
    assert data["body_logs"][0]["weight_kg"] == 82.4
    assert data["body_logs"][0]["log_date"] == "2026-10-29"
    assert data["meal_logs"][0]["option_key"] == "option_a"
    [w] = data["workouts"]
    assert w["notes"] == "Pull"
    assert w["sets"][0]["reps"] == 10 and w["sets"][0]["exercise_id"] == exercise_id
    assert any(e["id"] == exercise_id for e in data["exercises"])
    assert data["profile"]["height_cm"]


def test_export_is_plain_json_when_empty(client):
    with Session(engine) as db:
        data = build_export(db)
    json.dumps(data)
    assert data["workouts"] == [] and data["body_logs"] == []
