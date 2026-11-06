"""Export the plan content in content/ to one JSON file for the phone app.

    python scripts/export_content.py mobile/src/content.json

content/ stays the single source of truth (see CLAUDE.md). The phone app
reads this generated file and never keeps a hand-copied duplicate. Re-run
it whenever content/ changes; tests/test_export_content.py checks that the
output is complete and plain JSON."""

import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from content import (  # noqa: E402
    bonus_tasks,
    cardio_program,
    eating_out_guide,
    exercise_photos,
    exercise_targets,
    food_items,
    gym_exercises,
    gym_program,
    home_program,
    maintenance_plan,
    meal_plan,
    milestones,
    recovery_program,
    simple_meals,
)
from content.tdee import ACTIVITY_LEVELS, ACTIVITY_MULTIPLIERS, GENDERS  # noqa: E402

CONTENT_FORMAT = "fitness-os-content"
CONTENT_VERSION = 1
MEAL_CYCLE_DAYS = 14


def _plain(value):
    """Dates to ISO strings, tuples to lists, so json.dumps never chokes."""
    if isinstance(value, dict):
        return {str(k): _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_plain(v) for v in value]
    if isinstance(value, date):
        return value.isoformat()
    return value


def _day_with_items(n: int) -> dict:
    """get_day(n) plus each option's raw food keys, which the phone app's
    shopping list needs (get_day only carries display names)."""
    day = meal_plan.get_day(n)
    raw = meal_plan.MEAL_PLAN_14_DAY[(n - 1) % MEAL_CYCLE_DAYS]["meals"]
    for meal in day["meals"]:
        for option in meal["options"]:
            option["items"] = list(raw[meal["slot"]][option["key"]]["items"])
    return day


def build_content() -> dict:
    return _plain(
        {
            "format": CONTENT_FORMAT,
            "version": CONTENT_VERSION,
            "training": {
                "trainer_plan": gym_program.TRAINER_PLAN,
                "program": gym_program.PROGRAM,
                "session_time": gym_program.SESSION_TIME,
                "progression_note": gym_program.PROGRESSION_NOTE,
                "exercise_library": gym_exercises.SEED_EXERCISES,
                "home_program": home_program.PROGRAM,
                "home_alternates": home_program.ALTERNATE_EXERCISES,
                "recovery_checklist": recovery_program.RECOVERY_CHECKLIST,
                "cardio_session": cardio_program.CARDIO_SESSION,
                "cardio_alternatives": cardio_program.ALTERNATIVES,
                "exercise_photos": exercise_photos.EXERCISE_PHOTOS,
                "exercise_targets": {
                    name: {"main": main, "helpers": helpers, "angle": angle}
                    for name, (main, helpers, angle) in exercise_targets.EXERCISE_TARGETS.items()
                },
            },
            "nutrition": {
                "plan_start_date": meal_plan.PLAN_START_DATE,
                "meal_slots": meal_plan.MEAL_SLOTS,
                "meal_slot_windows": meal_plan.MEAL_SLOT_WINDOWS,
                "pre_workout_note": meal_plan.PRE_WORKOUT_NOTE,
                "macro_targets": meal_plan.MACRO_TARGETS,
                # E3-S9: friends open Meals on targets and guidance; Yusuf's
                # build keeps the full 14-day plan. Either can switch.
                "meals_default": "targets" if gym_program.FLAVOR == "friends" else "plan",
                "simple": {
                    "protein_foods": simple_meals.PROTEIN_FOODS,
                    "plate_guide": simple_meals.PLATE_GUIDE,
                    "meals_per_day": simple_meals.MEALS_PER_DAY,
                },
                "drink_options": meal_plan.DRINK_OPTIONS,
                "drinks": food_items.DRINKS,
                "days": [_day_with_items(n) for n in range(1, MEAL_CYCLE_DAYS + 1)],
                "foods": food_items.FOODS,
                "food_categories": food_items.FOOD_CATEGORIES,
                "category_order": food_items.CATEGORY_ORDER,
                "eating_out_tips": eating_out_guide.EATING_OUT_TIPS,
                "maintenance_intro": maintenance_plan.MAINTENANCE_INTRO,
                "maintenance_steps": maintenance_plan.MAINTENANCE_STEPS,
                "tdee": {"genders": GENDERS, "activity_levels": ACTIVITY_LEVELS, "multipliers": ACTIVITY_MULTIPLIERS},
            },
            "quests": {"bonus_tasks": bonus_tasks.BONUS_TASKS, "milestones": milestones.MILESTONES},
        }
    )


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "content.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(build_content(), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
