"""Orchestrates the dynamic (Spoonacular-backed) meal plan: syncing a
fresh set of recipes, and reading the currently-active plan through the
same shape the static content/meal_plan.py plan already uses — so every
caller (meals page, dashboard week preview, shopping list, email digest)
works identically whether a sync has ever been run or not.
"""

import json
import random
from typing import Optional

from sqlmodel import Session, select

from content.meal_plan import MACRO_TARGETS, MEAL_SLOT_WINDOWS, MEAL_SLOTS, get_day
from content.spoonacular_client import SpoonacularError, get_recipe_ingredients, search_recipes
from models import MealPlanSync, SyncedMealOption

DAY_COUNT = 14
OPTION_KEYS = ("option_a", "option_b")
CANDIDATES_PER_SLOT = 20
MIN_CANDIDATES_REQUIRED = 4
DAILY_KCAL_MID = 1975  # midpoint of the plan's ~1900-2050 kcal band
TOLERANCE = 0.35  # +/- band width around each slot's target, as a fraction

# Rough share of the daily macro band each slot covers — mirrors how the
# static plan is naturally weighted (two bigger meals, three lighter ones).
SLOT_SHARE = {
    "breakfast": 0.20,
    "snack1": 0.10,
    "lunch": 0.30,
    "snack2": 0.10,
    "dinner": 0.30,
}

EXCLUDE_INGREDIENTS = "wine,beer,vodka,rum,whiskey,champagne,liqueur,creatine,protein powder"

# Spoonacular's free-text "aisle" field mapped onto the app's existing
# 6-category shopping-list buckets, so synced ingredients get the same
# color-coded grouping as the static plan's. Falls back to the same
# catch-all category the static plan uses for anything unrecognized.
_AISLE_KEYWORDS = {
    "Protein & Mains": ["meat", "poultry", "seafood", "frozen meat"],
    "Dairy & Eggs": ["cheese", "milk, eggs", "dairy", "eggs"],
    "Grains & Bakery": ["bread", "bakery", "pasta and rice", "cereal", "baking"],
    "Legumes": ["canned and jarred", "beans"],
    "Produce & Salads": ["produce"],
    "Nuts, Sauces & Extras": ["nut", "spices and seasonings", "oil, vinegar, salad dressing", "condiments", "ethnic foods"],
}
_DEFAULT_CATEGORY = "Nuts, Sauces & Extras"


def map_aisle_to_category(aisle: str) -> str:
    aisle_lower = (aisle or "").lower()
    for category, keywords in _AISLE_KEYWORDS.items():
        if any(kw in aisle_lower for kw in keywords):
            return category
    return _DEFAULT_CATEGORY


def _slot_band(macro_total: float, share: float) -> tuple[float, float]:
    target = macro_total * share
    return max(0, target * (1 - TOLERANCE)), target * (1 + TOLERANCE)


def get_sync_status(session: Session) -> Optional[MealPlanSync]:
    return session.exec(select(MealPlanSync)).first()


def run_sync(session: Session) -> MealPlanSync:
    """Pulls a fresh pool of recipes per meal slot, matched to that slot's
    share of the daily macro band, then spreads them across all 14 days x
    2 options. Raises SpoonacularError on failure — callers should catch
    it and leave whatever plan was already active untouched."""
    slot_pools: dict[str, list[dict]] = {}
    for slot, share in SLOT_SHARE.items():
        kcal_lo, kcal_hi = _slot_band(DAILY_KCAL_MID, share)
        protein_lo, protein_hi = _slot_band(MACRO_TARGETS["protein"], share)
        carbs_lo, carbs_hi = _slot_band(MACRO_TARGETS["carbs"], share)
        fat_lo, fat_hi = _slot_band(MACRO_TARGETS["fat"], share)

        recipes = search_recipes(
            min_kcal=kcal_lo,
            max_kcal=kcal_hi,
            min_protein=protein_lo,
            max_protein=protein_hi,
            min_carbs=carbs_lo,
            max_carbs=carbs_hi,
            min_fat=fat_lo,
            max_fat=fat_hi,
            number=CANDIDATES_PER_SLOT,
            exclude_ingredients=EXCLUDE_INGREDIENTS,
        )
        if len(recipes) < MIN_CANDIDATES_REQUIRED:
            raise SpoonacularError(
                f"Only found {len(recipes)} recipes matching {slot}'s macro band — need at least {MIN_CANDIDATES_REQUIRED}."
            )
        random.shuffle(recipes)
        slot_pools[slot] = recipes

    # No sync history is kept — only the current plan matters here, unlike
    # the user's own logged data. Clear the previous one before writing.
    old_sync = get_sync_status(session)
    if old_sync:
        for old_option in session.exec(
            select(SyncedMealOption).where(SyncedMealOption.sync_id == old_sync.id)
        ).all():
            session.delete(old_option)
        session.delete(old_sync)
        session.commit()

    sync = MealPlanSync(recipe_count=sum(len(pool) for pool in slot_pools.values()))
    session.add(sync)
    session.commit()
    session.refresh(sync)

    ingredient_cache: dict[int, list[dict]] = {}
    for slot, pool in slot_pools.items():
        i = 0
        for day_index in range(1, DAY_COUNT + 1):
            for option_key in OPTION_KEYS:
                recipe = pool[i % len(pool)]
                i += 1
                recipe_id = recipe["recipe_id"]
                if recipe_id not in ingredient_cache:
                    ingredient_cache[recipe_id] = get_recipe_ingredients(recipe_id)
                session.add(
                    SyncedMealOption(
                        sync_id=sync.id,
                        day_index=day_index,
                        slot=slot,
                        option_key=option_key,
                        recipe_id=recipe_id,
                        title=recipe["title"],
                        image_url=recipe["image_url"],
                        source_url=recipe["source_url"],
                        kcal=recipe["kcal"],
                        protein=recipe["protein"],
                        carbs=recipe["carbs"],
                        fat=recipe["fat"],
                        fiber=recipe["fiber"],
                        ingredients_json=json.dumps(ingredient_cache[recipe_id]),
                    )
                )
    session.commit()
    return sync


def get_active_day(session: Session, day_number_1_indexed: int) -> dict:
    """Same return shape as content.meal_plan.get_day() — falls back to
    the static plan if no sync has ever completed (or one is partial)."""
    active = get_sync_status(session)
    if not active:
        return get_day(day_number_1_indexed)

    day_index = ((day_number_1_indexed - 1) % DAY_COUNT) + 1
    rows = session.exec(
        select(SyncedMealOption).where(
            SyncedMealOption.sync_id == active.id, SyncedMealOption.day_index == day_index
        )
    ).all()
    if not rows:
        return get_day(day_number_1_indexed)

    by_slot: dict[str, dict[str, SyncedMealOption]] = {}
    for row in rows:
        by_slot.setdefault(row.slot, {})[row.option_key] = row

    meals_out = []
    day_kcal = day_protein = day_carbs = day_fat = day_fiber = 0.0
    for slot in MEAL_SLOTS:
        slot_rows = by_slot.get(slot, {})
        options = []
        for option_key in OPTION_KEYS:
            row = slot_rows.get(option_key)
            if not row:
                continue
            ingredients = [
                f"{ing['name']} ({ing['amount']:g}{ing['unit']})" for ing in json.loads(row.ingredients_json)
            ]
            options.append(
                {
                    "key": row.option_key,
                    "cuisine": "Synced recipe",
                    "title": row.title,
                    "ingredients": ingredients,
                    "kcal": row.kcal,
                    "protein": row.protein,
                    "carbs": row.carbs,
                    "fat": row.fat,
                    "fiber": row.fiber,
                    "image_url": row.image_url,
                    "source_url": row.source_url,
                }
            )
        meals_out.append({"slot": slot, "time_window": MEAL_SLOT_WINDOWS[slot], "options": options})
        if options:
            day_kcal += options[0]["kcal"]
            day_protein += options[0]["protein"]
            day_carbs += options[0]["carbs"]
            day_fat += options[0]["fat"]
            day_fiber += options[0]["fiber"]

    return {
        "day_index": day_index,
        "label": f"Synced Plan — Day {day_index}",
        "is_refeed": False,
        "meals": meals_out,
        "totals": {
            "kcal": round(day_kcal),
            "protein": round(day_protein, 1),
            "carbs": round(day_carbs, 1),
            "fat": round(day_fat, 1),
            "fiber": round(day_fiber, 1),
        },
    }


def get_shopping_entries_for_day(session: Session, day_number_1_indexed: int, active: Optional[MealPlanSync]):
    """Yields (base_name, qty, unit, category) for every ingredient across
    both options and all 5 slots of the given day."""
    from content.food_items import FOOD_CATEGORIES, parse_shopping_unit
    from content.meal_plan import MEAL_PLAN_14_DAY

    if active:
        day_index = ((day_number_1_indexed - 1) % DAY_COUNT) + 1
        rows = session.exec(
            select(SyncedMealOption).where(
                SyncedMealOption.sync_id == active.id, SyncedMealOption.day_index == day_index
            )
        ).all()
        for row in rows:
            for ing in json.loads(row.ingredients_json):
                base = ing["name"].strip().lower()
                yield base, ing["amount"], ing["unit"] or "unit", map_aisle_to_category(ing.get("aisle", ""))
        return

    day = MEAL_PLAN_14_DAY[(day_number_1_indexed - 1) % DAY_COUNT]
    for slot in MEAL_SLOTS:
        for option_key in OPTION_KEYS:
            for item in day["meals"][slot][option_key]["items"]:
                base, qty, unit = parse_shopping_unit(item)
                yield base, qty, unit, FOOD_CATEGORIES.get(item, _DEFAULT_CATEGORY)
