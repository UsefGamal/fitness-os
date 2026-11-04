import importlib.util
import json
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "export_content", Path(__file__).resolve().parent.parent / "scripts" / "export_content.py"
)
assert _SPEC and _SPEC.loader
export_content = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(export_content)


def test_content_export_is_plain_json_and_complete():
    data = json.loads(json.dumps(export_content.build_content()))
    assert data["format"] == "fitness-os-content"
    training = data["training"]
    assert [d["key"] for d in training["program"]] == ["upper", "lower", "push", "pull", "leg"]
    assert training["session_time"] == "07:00"
    assert training["trainer_plan"]["schedule"][0]["day"] == "sunday"
    nutrition = data["nutrition"]
    assert len(nutrition["days"]) == export_content.MEAL_CYCLE_DAYS
    assert [m["slot"] for m in nutrition["days"][0]["meals"]] == nutrition["meal_slots"]
    assert nutrition["plan_start_date"] == "2026-09-01"
    assert data["quests"]["bonus_tasks"]
