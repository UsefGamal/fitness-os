"""The meal library (Nov 2026): rules every meal keeps."""

import re

import pytest

from content import ingredients, meal_library, meal_plan
from content.food_items import CATEGORY_ORDER
from content.meal_library import MEALS, MEALS_BY_KEY, PLAN_DAYS, PLAN_SLOTS, SLOT_KINDS, meal_option, meal_totals

BANNED = re.compile(r"\b(pork|bacon|ham|prosciutto|chorizo|pancetta|salami|lard|gammon|wine|beer|rum|brandy|vodka|sherry|cider|liqueur|bourbon|whisk(?:e)?y|gin|marsala|mirin|sake)\b", re.I)


def test_keys_are_unique():
    keys = [m["key"] for m in MEALS]
    assert len(keys) == len(set(keys))
    assert all(re.fullmatch(r"[a-z0-9_]+", k) for k in keys)


@pytest.mark.parametrize("m", MEALS, ids=lambda m: m["key"])
def test_each_meal(m):
    assert m["meals"] and set(m["meals"]) <= set(meal_library.SLOTS)
    assert m["protein"] in meal_library.PROTEINS
    assert set(m["tags"]) <= set(meal_library.TAGS)
    assert 0 < m["minutes"] <= 45
    if "quick" in m["tags"]:
        assert m["minutes"] <= 15, "quick means 15 minutes or less"
    assert m["steps"] and all(s.endswith(".") for s in m["steps"])
    assert set(m["pantry"]) <= ingredients.PANTRY, set(m["pantry"]) - ingredients.PANTRY
    for item in m["items"]:
        ing, amount, *unit = item
        assert ing in ingredients.INGREDIENTS, ing
        assert amount > 0 and unit in ([], ["pc"])
        if unit == ["pc"]:
            assert ingredients.INGREDIENTS[ing][9], f"{ing} is weighed, not counted"
        else:
            assert not ingredients.INGREDIENTS[ing][9], f"{ing} is counted in pieces"
    text = " ".join([m["name"], *m["steps"], *(i[0] for i in m["items"])])
    assert not BANNED.search(text), "no pork, no alcohol"


@pytest.mark.parametrize("m", MEALS, ids=lambda m: m["key"])
def test_portion_sizes_are_sensible(m):
    kcal, protein, *_ = meal_totals(m)
    if "snack" in m["meals"] and len(m["meals"]) <= 3 and "lunch" not in m["meals"]:
        assert 100 <= kcal <= 350, kcal
    else:
        assert 330 <= kcal <= 700, kcal
        assert protein >= 25, protein


def test_ingredient_rows():
    for key, row in ingredients.INGREDIENTS.items():
        name, plural, category, fdc, kcal, protein, carbs, fat, fiber, piece = row
        assert category in CATEGORY_ORDER, key
        assert isinstance(fdc, int) and fdc > 0
        # Energy roughly agrees with 4/4/9 (fibre and rounding allow slack).
        assert abs(protein * 4 + carbs * 4 + fat * 9 - kcal) <= max(30, kcal * 0.15), key
        assert piece is None or piece > 0


def test_plan_uses_library_meals_that_suit_the_slot():
    assert len(PLAN_DAYS) == 14
    for day in PLAN_DAYS:
        assert len(day) == len(PLAN_SLOTS)
        for slot, key in zip(PLAN_SLOTS, day, strict=True):
            assert set(MEALS_BY_KEY[key]["meals"]) & set(SLOT_KINDS[slot]), (slot, key)


def test_plan_days_stay_in_band():
    for n in range(1, 15):
        day = meal_plan.get_day(n)
        kcal, protein = day["totals"]["kcal"], day["totals"]["protein"]
        if day["is_refeed"]:
            assert 2100 <= kcal <= 2600
        else:
            assert 1750 <= kcal <= 2250, (n, kcal)
        assert protein >= 150, (n, protein)


def test_option_shape_matches_the_app():
    o = meal_option(MEALS[0])
    for k in ("key", "name", "items", "ingredients", "steps", "kcal", "protein", "carbs", "fat", "fiber"):
        assert k in o
    assert len(o["items"]) == len(o["ingredients"]) == len(MEALS[0]["items"])
    foods, names, cats = meal_library.item_foods()
    assert set(o["items"]) <= set(foods) and set(o["items"]) <= set(cats)


def test_meal_photos_are_open_and_credited():
    from content.meal_photos import MEAL_PHOTOS

    allowed = re.compile(r"^(CC0|Public domain|CC BY(-SA)? \d\.\d)$", re.I)
    for key, (title, author, licence) in MEAL_PHOTOS.items():
        assert key in MEALS_BY_KEY, key
        assert title.startswith("File:"), title
        assert author and "<" not in author, f"{key}: plain-text author"
        assert allowed.match(licence), f"{key}: {licence}"
        assert "goodfood" not in title.lower() and "bbc" not in title.lower()
