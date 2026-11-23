from datetime import date

from content.meal_library import MEALS_BY_KEY, PLAN_DAYS, PLAN_SLOTS, REFEED_DAY, meal_option

PLAN_START_DATE = date(2026, 9, 1)  # day 1 of the rotation — real program start date

MEAL_SLOTS = ["breakfast", "snack1", "lunch", "snack2", "dinner"]

# Hour windows each slot is meant to be eaten in, timed around the 7:00
# training session (content/gym_program.py SESSION_TIME): breakfast is the
# post-workout meal, once the session and its cycling finisher are done.
# Main meals are structured, snacks stay flexible.
MEAL_SLOT_WINDOWS = {
    "breakfast": "8:30–9:30",
    "snack1": "11:30–12:30",
    "lunch": "13:30–15:00",
    "snack2": "17:00–18:00",
    "dinner": "19:30–21:00",
}

# Shown above breakfast on training days.
PRE_WORKOUT_NOTE = "Before the 7:00 session: water, plus a coffee or a banana if you're hungry. Breakfast is your post-workout meal."

# Drinks selectable alongside any meal — all effectively zero-calorie.
DRINK_OPTIONS = ["water", "unsweetened_tea", "unsweetened_coffee", "diet_soda", "flavored_sparkling_water"]

# Daily macro targets (midpoints of the plan's structured-portion band) — used
# by the meals-page progress meters, not a strict calorie-counting target.
MACRO_TARGETS = {"protein": 185, "carbs": 150, "fat": 70, "fiber": 25}

# The 14-day plan is built from the meal library (content/meal_library.py,
# Nov 2026): one library meal per slot as the default, and any slot can be
# swapped for another library meal that suits it. Numbers come from the
# ingredients (content/ingredients.py, USDA), so they are never typed in.
# Portions are fitted to each person's calorie target in the app (FIT-1).


def get_day(day_number_1_indexed: int):
    """day_number_1_indexed cycles 1-14 regardless of input range. Each
    slot has one option: the plan's default library meal."""
    idx = (day_number_1_indexed - 1) % len(PLAN_DAYS)
    keys = PLAN_DAYS[idx]
    meals_out = []
    totals = {"kcal": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0, "fiber": 0.0}
    for slot, key in zip(PLAN_SLOTS, keys, strict=True):
        option = meal_option(MEALS_BY_KEY[key])
        meals_out.append({"slot": slot, "time_window": MEAL_SLOT_WINDOWS[slot], "options": [option]})
        for k in totals:
            totals[k] += option[k]
    return {
        "day_index": idx + 1,
        "label": MEALS_BY_KEY[keys[2]]["name"],
        "is_refeed": idx + 1 == REFEED_DAY,
        "meals": meals_out,
        "totals": {k: round(v) if k == "kcal" else round(v, 1) for k, v in totals.items()},
    }
