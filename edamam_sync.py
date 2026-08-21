"""Builds a 14-day meal plan from Edamam's Recipe Search API and adapts
it into the exact shape content.meal_plan.get_day() returns, so
routers/meals.py, main.py's dashboard, and the email digest don't need
to know whether they're looking at the static plan or a synced one.

Edamam's real per-account rate limit turned out to be much tighter and
less predictable than documented — retries with a generous backoff (see
edamam_client.py) are necessary for a sync to reliably complete, which
can take over a minute. So unlike a naive synchronous design, the actual
work runs as a FastAPI background task (see routers/meals.py's
trigger_edamam_sync): start_sync() creates a 'pending' row and returns
immediately, run_sync_in_background() does the real querying/assembly
against its own DB session afterward.

Falls through to fitchef_sync.get_active_day() (which itself falls back
to the static plan) whenever no Edamam sync is active — priority is
Edamam > FitChef > static.
"""

import json
import time
from datetime import datetime, timedelta

from sqlmodel import Session, select

import fitchef_sync
from content.meal_plan import MEAL_SLOT_WINDOWS, MEAL_SLOTS
from database import engine
from edamam_client import EdamamError, normalize_recipe, search_recipes
from macro_targets import get_macro_targets
from models import EdamamPlanSync

# Always-on exclusions per the user's stated diet: no pork, no alcohol,
# no shellfish. Edamam has first-class health labels for all three
# (unlike FitChef, which only had per-ingredient bacon/ham excludes).
# diet=high-protein was tried too, but combined with cuisineType +
# health + mealType + a calorie band it over-constrains the query to
# zero results in practice — protein is already handled by which query
# terms we search for (chicken, eggs, greek yogurt, etc.) and by our own
# macro tracking on top of whatever recipes come back, so it isn't
# actually needed as a hard filter here.
HEALTH_LABELS = ["pork-free", "alcohol-free", "shellfish-free"]
CUISINE_TYPE = "Mediterranean"

# A small courtesy gap between *distinct* queries, on top of
# edamam_client's own retry/backoff on 429 — reduces (but doesn't
# guarantee against) how often a query needs to retry at all.
INTER_QUERY_DELAY_SECONDS = 5

# Roughly how much of the daily calorie target each slot should carry —
# mirrors the static plan's rough breakfast/snack/lunch/snack/dinner shape.
SLOT_KCAL_SHARE = {"breakfast": 0.20, "snack1": 0.10, "lunch": 0.30, "snack2": 0.10, "dinner": 0.30}

# One search term per slot — a single query already returns up to 20
# recipes, plenty of variety for 14 days of cycling, and keeps the total
# number of real API calls (and therefore worst-case retry time) as low
# as possible. Fish terms are deliberately absent from breakfast/dinner
# (fish is fine at lunch/snacks, not at breakfast or dinner, per the
# stated preference) — Edamam has no reliable per-slot fish exclusion
# label, so this doesn't *exclude* fish there, it just means we never
# deliberately search for it in those two slots.
SLOT_QUERIES = {
    "breakfast": ["eggs"],
    "snack1": ["greek yogurt"],
    "lunch": ["chicken salad"],
    "snack2": ["hummus"],
    "dinner": ["grilled chicken"],
}

# Worst case (every one of 5 slots needs the full retry ladder) is well
# under this, but a background task has no durability guarantee — if the
# process restarts or is killed mid-sync (a deploy, a manual restart, a
# Render free-tier spin-down) the row is orphaned in 'pending' forever
# with nothing left running to finish it. Past this age, treat it as
# dead rather than let it block every future sync attempt indefinitely.
PENDING_TIMEOUT_MINUTES = 10


def latest_sync(session: Session) -> EdamamPlanSync | None:
    return session.exec(select(EdamamPlanSync).order_by(EdamamPlanSync.id.desc())).first()


def is_pending_stale(sync: EdamamPlanSync) -> bool:
    """True once a 'pending' row has outlived any plausible real sync
    duration — see PENDING_TIMEOUT_MINUTES. Always False for
    complete/error rows, which aren't "stale," just finished."""
    if sync.status != "pending":
        return False
    return datetime.utcnow() - sync.requested_at > timedelta(minutes=PENDING_TIMEOUT_MINUTES)


def _latest_complete_sync(session: Session) -> EdamamPlanSync | None:
    return session.exec(
        select(EdamamPlanSync).where(EdamamPlanSync.status == "complete").order_by(EdamamPlanSync.id.desc())
    ).first()


def start_sync(session: Session) -> EdamamPlanSync:
    """Creates the pending row and returns immediately — no API calls
    here. Call run_sync_in_background() (e.g. via FastAPI BackgroundTasks)
    to actually do the work."""
    sync = EdamamPlanSync(status="pending")
    session.add(sync)
    session.commit()
    session.refresh(sync)
    return sync


def _build_slot_pool(slot: str, kcal_target: int, delay_before_first: bool) -> list[dict]:
    meal_type = "breakfast" if slot == "breakfast" else ("snack" if slot in ("snack1", "snack2") else "lunch/dinner")
    band_low, band_high = max(50, round(kcal_target * 0.6)), round(kcal_target * 1.5)

    pool: dict[str, dict] = {}
    for i, query in enumerate(SLOT_QUERIES[slot]):
        if i > 0 or delay_before_first:
            time.sleep(INTER_QUERY_DELAY_SECONDS)
        recipes = search_recipes(
            query=query,
            meal_type=meal_type,
            cuisine_type=CUISINE_TYPE,
            health=HEALTH_LABELS,
            calories_min=band_low,
            calories_max=band_high,
        )
        for recipe in recipes:
            normalized = normalize_recipe(recipe)
            pool[normalized["uri"]] = normalized
        if len(pool) >= 12:  # enough variety for 14 days without hitting every query term
            break
    return list(pool.values())


def run_sync_in_background(sync_id: int) -> None:
    """Runs with its own DB session — the request-scoped session used by
    the route that kicked this off is long closed by the time this
    executes. Never raises; always leaves the row in 'complete' or
    'error'."""
    with Session(engine) as session:
        sync = session.get(EdamamPlanSync, sync_id)
        if sync is None:
            return
        try:
            targets = get_macro_targets(session)
            daily_kcal = targets["kcal"]

            pools = {}
            for i, slot in enumerate(MEAL_SLOTS):
                kcal_target = round(daily_kcal * SLOT_KCAL_SHARE[slot])
                pool = _build_slot_pool(slot, kcal_target, delay_before_first=i > 0)
                if not pool:
                    raise EdamamError(f"No recipes found for {slot} within our macro/diet constraints")
                pools[slot] = pool

            days = []
            for day_index in range(1, 15):
                # Day 7 and day 14: refeed days (weekly, not just the last
                # day of the cycle — see nutrition-domain skill notes on a
                # deficit this size wanting more than one break per 14 days).
                is_refeed = day_index in (7, 14)
                meals = {}
                for slot in MEAL_SLOTS:
                    pool = pools[slot]
                    if is_refeed:
                        # fitchef_sync.py's refeed applies a flat kcal/carb/fat
                        # bump (REFEED_EXTRA_CARBS_G/REFEED_EXTRA_FAT_G) via a
                        # config Edamam's recipe-search API has no equivalent
                        # for — a second round of queries just for this one day
                        # isn't worth it against Edamam's already-tight rate
                        # limit (see sync-job-pattern), so instead this picks
                        # the two highest-calorie recipes already fetched for
                        # this slot (the pool's search band already reaches up
                        # to 1.5x the slot's normal target — see
                        # _build_slot_pool) rather than the regular cyclic
                        # pick. Same protein target either way, more food that
                        # day, no extra API cost.
                        ranked = sorted(pool, key=lambda r: r["kcal"], reverse=True)
                        idx_a, idx_b = 0, min(1, len(ranked) - 1)
                        meals[slot] = {"option_a": ranked[idx_a], "option_b": ranked[idx_b]}
                    else:
                        # Cycle through the pool so 14 days of variety come
                        # from a handful of queries — option_a/option_b are
                        # two distinct picks (or the same one repeated if the
                        # pool has only one).
                        idx_a = (day_index - 1) % len(pool)
                        idx_b = (day_index - 1 + len(pool) // 2 or 1) % len(pool)
                        meals[slot] = {"option_a": pool[idx_a], "option_b": pool[idx_b]}
                label = meals.get("lunch", {}).get("option_a", {}).get("name", "Edamam Day")
                days.append({"day_index": day_index, "label": label, "is_refeed": is_refeed, "meals": meals})

            products = _build_shopping_list(days)

            sync.status = "complete"
            sync.plan_json = json.dumps(days)
            sync.products_json = json.dumps(products)
            sync.synced_at = datetime.utcnow()
            session.add(sync)
            session.commit()
        except EdamamError as exc:
            _mark_error(session, sync, str(exc))
        except Exception as exc:  # noqa: BLE001 — a background task must never raise unhandled
            _mark_error(session, sync, f"Unexpected error: {exc}"[:300])


def _mark_error(session: Session, sync: EdamamPlanSync, detail: str) -> None:
    sync.status = "error"
    sync.error_detail = detail[:300]
    session.add(sync)
    session.commit()


def _build_shopping_list(days: list[dict]) -> list[dict]:
    """Aggregates by Edamam's own food_id (falls back to the normalized
    food name if a foodId is missing) — this is what actually merges "1
    clove garlic" / "2 cloves garlic" / "4 garlic cloves" from different
    recipes into one line, instead of listing each recipe's exact
    wording separately (the original bug: this used to aggregate on raw
    ingredientLines text, where near-identical phrasing never matched).
    Summing weight_g gives one consistent unit across recipes that
    phrase quantities differently; "category" comes straight from
    Edamam's own foodCategory, so the list is actually grouped instead
    of one flat wall of text."""
    merged: dict[str, dict] = {}
    for day in days:
        for slot_meals in day["meals"].values():
            for option in (slot_meals["option_a"], slot_meals["option_b"]):
                for ing in option.get("structured_ingredients", []):
                    key = ing.get("food_id") or ing["food"]
                    entry = merged.setdefault(
                        key, {"name": ing["food"], "category": ing["category"], "weight_g": 0.0, "count": 0}
                    )
                    if ing.get("weight_g"):
                        entry["weight_g"] += ing["weight_g"]
                    entry["count"] += 1

    products = []
    for item in merged.values():
        if item["weight_g"] >= 1000:
            qty = f"{round(item['weight_g'] / 1000, 1)} kg"
        elif item["weight_g"] > 0:
            qty = f"{round(item['weight_g'])} g"
        else:  # some foods (e.g. "salt to taste") never carry a weight — fall back to a use-count
            qty = f"×{item['count']}"
        products.append({"name": item["name"].title(), "category": item["category"], "quantity": qty})
    return sorted(products, key=lambda p: (p["category"], p["name"]))


def _build_synced_day(stored_day: dict) -> dict:
    meals_out = []
    day_kcal = day_protein = day_carbs = day_fat = day_fiber = 0.0
    for slot in MEAL_SLOTS:
        slot_meals = stored_day["meals"][slot]
        options = []
        for key in ("option_a", "option_b"):
            opt = slot_meals[key]
            options.append(
                {
                    "key": key,
                    "cuisine": "Edamam",
                    "name": opt.get("name", "Recipe"),
                    "url": opt.get("url"),
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

    # Self-heals plans synced before the day-label fix (label used to be
    # hardcoded "Edamam Day" at sync time and baked into plan_json forever
    # — see git history around "Surface the recipe name and source link on
    # /meals"). Deriving it here instead of trusting the stored value means
    # already-synced data picks up the fix on the next render, no re-sync
    # required.
    label = stored_day.get("label")
    if not label or label == "Edamam Day":
        lunch = next((m for m in meals_out if m["slot"] == "lunch"), None)
        label = lunch["options"][0]["name"] if lunch else "Edamam Day"

    return {
        "day_index": stored_day["day_index"],
        "label": label,
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
    sync = _latest_complete_sync(session)
    if not sync or not sync.plan_json:
        return fitchef_sync.get_active_day(session, day_number_1_indexed)
    plan = json.loads(sync.plan_json)
    if not plan:
        return fitchef_sync.get_active_day(session, day_number_1_indexed)
    idx = (day_number_1_indexed - 1) % len(plan)
    return _build_synced_day(plan[idx])


def get_active_shopping_products(session: Session) -> list | None:
    sync = _latest_complete_sync(session)
    if not sync or not sync.products_json:
        return fitchef_sync.get_active_shopping_products(session)
    return json.loads(sync.products_json)
