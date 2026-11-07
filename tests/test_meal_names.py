"""P14-19: meal names read naturally, and the numbers don't move."""

from content import meal_plan
from content.food_items import FOOD_NAMES, FOODS, natural_items, parse_shopping_unit


def test_every_food_has_a_name():
    bases = {parse_shopping_unit(k)[0] for k in FOODS}
    assert bases <= set(FOOD_NAMES), sorted(bases - set(FOOD_NAMES))


def test_repeats_are_merged():
    assert natural_items(["ful_medames_bowl", "boiled_egg", "boiled_egg", "whole_wheat_pita_half"]) == [
        "a bowl of ful medames", "2 boiled eggs", "half a wholewheat pita",
    ]
    assert natural_items(["grilled_chicken_breast_150g", "grilled_chicken_breast_150g"]) == ["grilled chicken breast 300 g"]
    assert natural_items(["dates_3pc", "avocado_half", "whole_wheat_toast_2slices", "labneh_2tbsp"]) == [
        "3 dates", "half an avocado", "2 slices of wholewheat toast", "labneh 2 tbsp",
    ]


def test_no_title_cased_keys_in_the_plan():
    for n in range(1, 15):
        for meal in meal_plan.get_day(n)["meals"]:
            for option in meal["options"]:
                names = option["ingredients"]
                assert len(names) == len(set(names))
                for name in names:
                    assert "_" not in name
                    words = name.split()
                    # Sentence case: only proper nouns (Greek, Syrian) are capitalised.
                    assert all(w.islower() or w in {"Greek", "Syrian"} or not w[0].isalpha() for w in words), name


def test_numbers_unchanged():
    # Day 1's option A macros, as before the names changed.
    day = meal_plan.get_day(1)
    a = day["meals"][0]["options"][0]
    assert (a["kcal"], a["protein"]) == meal_plan.compute_macros(["ful_medames_bowl", "boiled_egg", "boiled_egg", "whole_wheat_pita_half"])[:2]
