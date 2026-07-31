"""Orchestrates a FitChef sync (two chained weekly generations -> one
14-day plan) and adapts the result into the exact shape
content.meal_plan.get_day() returns, so routers/meals.py, main.py's
dashboard, and the email digest don't need to know whether they're
looking at the static plan or a synced one.

Flow: start_sync() kicks off week 1 and returns immediately (FitChef
generation is async, 30-180s typical). advance_sync() is a cheap,
idempotent "poke" — call it on page load while a sync is in flight; it
does nothing once status is complete/error. When week 1 finishes it
chains recipeHistory into a week 2 request (so the two weeks don't repeat
recipes) and bumps day 14's macro target for the refeed. When week 2
finishes, both weeks are merged into one 14-day plan and the aggregated
shopping list is stored.

No webhook signature verification is set up (see fitchef_client.py), so
this module never trusts webhook content — advance_sync's polling via
GET /api/v2/mealplan/{identifier} is the only source of truth.
"""

import json
from datetime import datetime

import httpx
from sqlmodel import Session, select

from content.meal_plan import MACRO_TARGETS, MEAL_SLOT_WINDOWS, MEAL_SLOTS
from content.meal_plan import get_day as get_static_day
from fitchef_client import FitChefError, fetch_mealplan, get_access_token, request_mealplan
from models import MealPlanSync

# Only pork products FitChef's catalog exposes an excludable set for (see
# GET /api/v2/exclusion-data) — there's no generic "pork" tag, so this is
# the closest available lever, not a provable guarantee.
PORK_EXCLUDED_SETS = ["bacon", "ham"]

NORMAL_MACROS = {"carbohydrate": MACRO_TARGETS["carbs"], "protein": MACRO_TARGETS["protein"], "fat": MACRO_TARGETS["fat"]}
# Day 14 (last day of week 2, validOn index 6) gets a bumped target so the
# existing refeed-day pattern continues under synced plans too.
REFEED_MACROS = {"carbohydrate": 220, "protein": 185, "fat": 80}

# breakfast/lunch/dinner map 1:1; FitChef's two snack moments map onto ours.
# snack_evening has no equivalent slot in this app and is dropped.
_FITCHEF_SLOT_MAP = {
    "breakfast": "breakfast",
    "snack_morning": "snack1",
    "lunch": "lunch",
    "snack_afternoon": "snack2",
    "dinner": "dinner",
}


def latest_sync(session: Session) -> MealPlanSync | None:
    """Most recent sync of any status — drives the /more page's status UI."""
    return session.exec(select(MealPlanSync).order_by(MealPlanSync.id.desc())).first()


def _latest_complete_sync(session: Session) -> MealPlanSync | None:
    return session.exec(
        select(MealPlanSync).where(MealPlanSync.status == "complete").order_by(MealPlanSync.id.desc())
    ).first()


def start_sync(session: Session) -> MealPlanSync:
    token = get_access_token()
    identifier = request_mealplan(
        token,
        carbohydrate=NORMAL_MACROS["carbohydrate"],
        protein=NORMAL_MACROS["protein"],
        fat=NORMAL_MACROS["fat"],
        excluded_sets=PORK_EXCLUDED_SETS,
    )
    sync = MealPlanSync(status="week1_pending", week1_identifier=identifier)
    session.add(sync)
    session.commit()
    session.refresh(sync)
    return sync


def advance_sync(session: Session, sync: MealPlanSync) -> MealPlanSync:
    """Idempotent progress-check — safe to call on every page load. A no-op
    once status is 'complete' or 'error'."""
    if sync.status in ("complete", "error"):
        return sync
    try:
        token = get_access_token()
        if sync.status == "week1_pending":
            return _advance_week1(session, sync, token)
        if sync.status == "week2_pending":
            return _advance_week2(session, sync, token)
    except FitChefError as exc:
        return _mark_error(session, sync, str(exc))
    except httpx.HTTPError as exc:
        return _mark_error(session, sync, f"Network/API error: {exc}")
    return sync


def _advance_week1(session: Session, sync: MealPlanSync, token: str) -> MealPlanSync:
    payload = fetch_mealplan(token, sync.week1_identifier)
    if payload is None:
        return sync  # still generating

    sync.week1_json = json.dumps(payload)
    history = json.dumps(payload.get("recipeHistory", {}))
    sync.recipe_history = history

    identifier2 = request_mealplan(
        token,
        carbohydrate=NORMAL_MACROS["carbohydrate"],
        protein=NORMAL_MACROS["protein"],
        fat=NORMAL_MACROS["fat"],
        excluded_sets=PORK_EXCLUDED_SETS,
        recipe_history=history,
        configured_days=[{"validOn": [6], "nutrition": REFEED_MACROS}],
    )
    sync.week2_identifier = identifier2
    sync.status = "week2_pending"
    session.add(sync)
    session.commit()
    session.refresh(sync)
    return sync


def _advance_week2(session: Session, sync: MealPlanSync, token: str) -> MealPlanSync:
    payload2 = fetch_mealplan(token, sync.week2_identifier)
    if payload2 is None:
        return sync  # still generating

    payload1 = json.loads(sync.week1_json)
    # FitChef's actual day count per generation isn't guaranteed to be 7 —
    # merge however many each call actually returned instead of assuming a
    # fixed week length (a hardcoded [:7]/%14 here caused a production
    # IndexError the first time a real generation came back short).
    week1_days = payload1.get("days") or []
    week2_days = payload2.get("days") or []
    merged_days = [_map_fitchef_day(day, i + 1, is_refeed=False) for i, day in enumerate(week1_days)]
    merged_days += [
        _map_fitchef_day(day, i + len(week1_days) + 1, is_refeed=(i == len(week2_days) - 1))
        for i, day in enumerate(week2_days)
    ]

    if not merged_days:
        return _mark_error(session, sync, "FitChef's completed generation contained no days")

    products = (payload1.get("products") or []) + (payload2.get("products") or [])

    sync.plan_json = json.dumps(merged_days)
    sync.products_json = json.dumps(_merge_products(products))
    sync.recipe_history = json.dumps(payload2.get("recipeHistory", {}))
    sync.week1_json = None  # no longer needed once merged
    sync.status = "complete"
    sync.completed_at = datetime.utcnow()
    session.add(sync)
    session.commit()
    session.refresh(sync)
    return sync


def _mark_error(session: Session, sync: MealPlanSync, detail: str) -> MealPlanSync:
    sync.status = "error"
    sync.error_detail = detail[:300]
    session.add(sync)
    session.commit()
    session.refresh(sync)
    return sync


def _merge_products(products: list) -> list:
    merged: dict = {}
    for p in products:
        pid = p.get("id") or p.get("productId")
        if pid in merged:
            merged[pid]["quantity"] = merged[pid].get("quantity", 0) + p.get("quantity", 0)
            merged[pid]["total"] = round(merged[pid].get("total", 0) + p.get("total", 0), 2)
        else:
            merged[pid] = dict(p)
    return sorted(merged.values(), key=lambda p: p.get("name", ""))


def _map_meal_option(meal: dict) -> dict:
    nutrition = meal.get("nutrition") or {}
    carb = nutrition.get("carbohydrate", 0) or 0
    protein = nutrition.get("protein", 0) or 0
    fat = nutrition.get("fat", 0) or 0
    fiber = nutrition.get("fiber", 0) or 0
    return {
        "name": meal.get("name", "FitChef recipe"),
        "ingredients": [ing.get("name", "?") for ing in meal.get("ingredients", [])],
        "kcal": round(carb * 4 + protein * 4 + fat * 9),
        "protein": round(protein, 1),
        "carbs": round(carb, 1),
        "fat": round(fat, 1),
        "fiber": round(fiber, 1),
    }


def _map_fitchef_day(day_payload: dict, day_index: int, is_refeed: bool) -> dict:
    meals = {}
    for meal in day_payload.get("meals", []):
        our_slot = _FITCHEF_SLOT_MAP.get(meal.get("mealName"))
        if not our_slot:
            continue
        alternatives = meal.get("alternatives") or []
        option_a = _map_meal_option(meal)
        option_b = _map_meal_option(alternatives[0]) if alternatives else option_a
        meals[our_slot] = {"option_a": option_a, "option_b": option_b}

    label_source = meals.get("lunch", {}).get("option_a", {}).get("name", "FitChef")
    return {"day_index": day_index, "label": f"{label_source} Day", "is_refeed": is_refeed, "meals": meals}


# Used when FitChef's generator didn't return a given slot at all — keeps
# every downstream consumer (meals.html, the email digest, macro totals)
# able to assume exactly 2 options per slot, same as the static plan,
# instead of needing special-case handling for a missing/empty slot.
_MISSING_OPTION = {"name": "Not provided by this sync", "ingredients": [], "kcal": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0}


def _build_synced_day(stored_day: dict) -> dict:
    meals_out = []
    day_kcal = day_protein = day_carbs = day_fat = day_fiber = 0.0
    for slot in MEAL_SLOTS:
        slot_meals = stored_day["meals"].get(slot) or {"option_a": _MISSING_OPTION, "option_b": _MISSING_OPTION}
        options = []
        for key in ("option_a", "option_b"):
            opt = slot_meals[key]
            options.append(
                {
                    "key": key,
                    "cuisine": "FitChef",
                    "ingredients": opt["ingredients"],
                    "kcal": opt["kcal"],
                    "protein": opt["protein"],
                    "carbs": opt["carbs"],
                    "fat": opt["fat"],
                    "fiber": opt["fiber"],
                }
            )
        day_kcal += options[0]["kcal"]
        day_protein += options[0]["protein"]
        day_carbs += options[0]["carbs"]
        day_fat += options[0]["fat"]
        day_fiber += options[0]["fiber"]
        meals_out.append({"slot": slot, "time_window": MEAL_SLOT_WINDOWS[slot], "options": options})

    return {
        "day_index": stored_day["day_index"],
        "label": stored_day["label"],
        "is_refeed": stored_day.get("is_refeed", False),
        "meals": meals_out,
        "totals": {
            "kcal": round(day_kcal),
            "protein": round(day_protein, 1),
            "carbs": round(day_carbs, 1),
            "fat": round(day_fat, 1),
            "fiber": round(day_fiber, 1),
        },
    }


def get_active_day(session: Session, day_number_1_indexed: int) -> dict:
    """Drop-in replacement for content.meal_plan.get_day() that prefers the
    latest completed FitChef sync, falling back to the static plan if none
    exists yet."""
    sync = _latest_complete_sync(session)
    if not sync or not sync.plan_json:
        return get_static_day(day_number_1_indexed)
    plan = json.loads(sync.plan_json)
    if not plan:
        return get_static_day(day_number_1_indexed)
    idx = (day_number_1_indexed - 1) % len(plan)
    return _build_synced_day(plan[idx])


def get_active_shopping_products(session: Session) -> list | None:
    """Returns FitChef's aggregated products list if a synced plan is
    active, else None (caller falls back to the static-plan shopping
    list builder)."""
    sync = _latest_complete_sync(session)
    if not sync or not sync.products_json:
        return None
    return json.loads(sync.products_json)
