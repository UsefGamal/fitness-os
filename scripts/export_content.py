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
    fitness_test,
    food_items,
    gym_exercises,
    gym_program,
    home_program,
    ingredients,
    maintenance_plan,
    meal_library,
    meal_plan,
    milestones,
    progressions,
    recovery_program,
    routines,
    safety_swaps,
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


def build_content() -> dict:
    LIB_FOODS, LIB_NAMES, LIB_CATEGORIES = meal_library.item_foods()
    return _plain(
        {
            "format": CONTENT_FORMAT,
            "version": CONTENT_VERSION,
            "training": {
                # The plan a new install starts on (key name kept from v1).
                "trainer_plan": gym_program.DEFAULT_PLAN,
                "program": gym_program.PROGRAM,
                "routines": routines.ROUTINES,
                "session_time": gym_program.SESSION_TIME,
                "progression_note": gym_program.PROGRESSION_NOTE,
                "exercise_library": gym_exercises.SEED_EXERCISES,
                "home_program": home_program.PROGRAM,
                "home_alternates": home_program.ALTERNATE_EXERCISES,
                "recovery_checklist": recovery_program.RECOVERY_CHECKLIST,
                "cardio_session": cardio_program.CARDIO_SESSION,
                "cardio_alternatives": cardio_program.ALTERNATIVES,
                "progressions": progressions.LADDERS,
                "fitness_test": {"every_days": fitness_test.EVERY_DAYS, "items": fitness_test.ITEMS, "guide": fitness_test.GUIDE},
                "exercise_photos": exercise_photos.EXERCISE_PHOTOS,
                "safety_swaps": {"areas": safety_swaps.AREAS, "swaps": safety_swaps.SWAPS},
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
                # E3-S9: Meals opens on targets and guidance; the full 14-day
                # plan is one tap away and the choice is kept.
                "meals_default": "targets",
                "simple": {
                    "protein_foods": simple_meals.PROTEIN_FOODS,
                    "plate_guide": simple_meals.PLATE_GUIDE,
                    "meals_per_day": simple_meals.MEALS_PER_DAY,
                },
                # Rule A (E3-S13): a deficit is at most 25% of TDEE, for
                # everyone (Yusuf chose one limit for all, 20 Nov 2026).
                "max_deficit_share": 0.25,
                "drink_options": meal_plan.DRINK_OPTIONS,
                "drinks": food_items.DRINKS,
                "days": [meal_plan.get_day(n) for n in range(1, MEAL_CYCLE_DAYS + 1)],
                # The meal library (content/meal_library.py): every meal a slot
                # can be swapped to, and which plan slots each kind suits.
                "library": [meal_library.meal_option(m) for m in meal_library.MEALS],
                "slot_kinds": meal_library.SLOT_KINDS,
                "ramadan_slot_kinds": meal_library.RAMADAN_SLOT_KINDS,
                "library_tags": meal_library.TAGS,
                "library_proteins": meal_library.PROTEINS,
                "nutrition_source": ingredients.USDA_SOURCE,
                "foods": {**food_items.FOODS, **LIB_FOODS},
                "food_categories": {**food_items.FOOD_CATEGORIES, **LIB_CATEGORIES},
                "food_names": {**{k: v[0] for k, v in food_items.FOOD_NAMES.items()}, **LIB_NAMES},
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
