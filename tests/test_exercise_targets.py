"""Every exercise in the plans has hand-checked muscles (E4-S16)."""

import json
from pathlib import Path

from content.exercise_targets import EXERCISE_TARGETS

ROOT = Path(__file__).resolve().parent.parent


def _plan_names(path: Path) -> set[str]:
    names: set[str] = set()

    def walk(value):
        if isinstance(value, dict):
            if isinstance(value.get("name"), str) and ("sets" in value or "reps" in value):
                names.add(value["name"])
            for v in value.values():
                walk(v)
        elif isinstance(value, list):
            for v in value:
                walk(v)

    walk(json.loads(path.read_text(encoding="utf-8")))
    return names


def test_every_plan_exercise_is_checked():
    for plan in ("trainer_plan.json", "starter_plan.json"):
        missing = _plan_names(ROOT / "content" / plan) - set(EXERCISE_TARGETS)
        assert not missing, f"{plan}: add these to content/exercise_targets.py: {sorted(missing)}"


def test_entries_are_well_formed():
    for name, (main, helpers, angle) in EXERCISE_TARGETS.items():
        assert main, name
        assert not set(main) & set(helpers), name
        assert angle is None or isinstance(angle, str), name
