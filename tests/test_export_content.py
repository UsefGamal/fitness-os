"""The content export (scripts/export_content.py). Structural asserts only
(E4-S3): the shape the phone app reads, not today's exact plan, so editing
content doesn't break these tests."""

import importlib.util
import json
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "export_content", Path(__file__).resolve().parent.parent / "scripts" / "export_content.py"
)
assert _SPEC and _SPEC.loader
export_content = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(export_content)

WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]


def test_content_export_is_plain_json_with_every_section():
    data = json.loads(json.dumps(export_content.build_content()))
    assert data["format"] == "fitness-os-content"
    assert {"training", "nutrition", "quests"} <= data.keys()


def test_training_shape():
    training = export_content.build_content()["training"]
    keys = [d["key"] for d in training["program"]]
    assert keys and len(keys) == len(set(keys))
    for day in training["program"]:
        assert day["label"] and day["focus"] and day["exercises"]
        for ex in day["exercises"]:
            assert ex["name"] and int(ex["sets"]) >= 1 and ex["reps"]
    schedule = training["trainer_plan"]["schedule"]
    assert [d["day"] for d in schedule] == WEEKDAYS
    assert {d["session"] for d in schedule} <= set(keys) | {"rest"}
    assert any(d["session"] != "rest" for d in schedule)
    hh, mm = training["session_time"].split(":")
    assert 0 <= int(hh) < 24 and 0 <= int(mm) < 60


def test_nutrition_shape():
    nutrition = export_content.build_content()["nutrition"]
    assert len(nutrition["days"]) == export_content.MEAL_CYCLE_DAYS
    for day in nutrition["days"]:
        assert [m["slot"] for m in day["meals"]] == nutrition["meal_slots"]
        for meal in day["meals"]:
            assert meal["options"] and all(o["kcal"] > 0 for o in meal["options"])
    assert len(nutrition["plan_start_date"]) == 10
    assert set(nutrition["macro_targets"]) >= {"protein", "carbs", "fat"}


def test_quests_shape():
    quests = export_content.build_content()["quests"]
    assert quests["bonus_tasks"] and quests["milestones"]
    assert all(t["frequency"] in {"daily", "weekly", "once"} for t in quests["bonus_tasks"])
