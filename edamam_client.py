"""Thin client for Edamam's Recipe Search API v2 — a plain synchronous
GET (unlike FitChef's async job/polling model), so there's no client-side
state machine needed here at all.

Edamam issues separate App ID/App Key pairs per product (Recipe Search,
Nutrition Analysis, Food Database, Meal Planner are all distinct
applications) — these credentials must be from the "Recipe Search API"
application specifically, confirmed working against the real (non-
sandbox) catalog during development.
"""

import os
import time

import httpx

BASE_URL = "https://api.edamam.com/api/recipes/v2"

# Edamam's real per-account throttle turned out to be much tighter and
# less predictable than the documented 50/min, 1000/day figures — an
# isolated call always succeeds instantly, but calls even 15-20s apart
# sometimes still 429. Retrying with a generous backoff is necessary,
# not optional, for a sync to reliably complete at all.
MAX_RETRIES = 4
RETRY_BACKOFF_SECONDS = [10, 20, 30, 45]


class EdamamError(Exception):
    pass


def _app_id() -> str:
    return os.getenv("EDAMAM_APP_ID", "")


def _app_key() -> str:
    return os.getenv("EDAMAM_APP_KEY", "")


def search_recipes(
    *,
    query: str,
    meal_type: str | None = None,
    cuisine_type: str | None = None,
    health: list[str] | None = None,
    diet: list[str] | None = None,
    calories_min: int | None = None,
    calories_max: int | None = None,
) -> list[dict]:
    """Returns up to 20 raw recipe dicts (Edamam's fixed page size) — call
    normalize_recipe() on each before using elsewhere in the app.
    Retries on 429 with backoff (see RETRY_BACKOFF_SECONDS) before giving
    up — meant to be called from a background task, not a request
    handler, since a single call can legitimately take over a minute."""
    if not _app_id() or not _app_key():
        raise EdamamError("EDAMAM_APP_ID/EDAMAM_APP_KEY not configured")

    params = {"type": "public", "q": query, "app_id": _app_id(), "app_key": _app_key()}
    if meal_type:
        params["mealType"] = meal_type
    if cuisine_type:
        params["cuisineType"] = cuisine_type
    if health:
        params["health"] = health
    if diet:
        params["diet"] = diet
    if calories_min is not None and calories_max is not None:
        params["calories"] = f"{calories_min}-{calories_max}"

    for attempt in range(MAX_RETRIES + 1):
        response = httpx.get(BASE_URL, params=params, timeout=15)
        if response.status_code == 401:
            raise EdamamError("Edamam auth failed — check EDAMAM_APP_ID/EDAMAM_APP_KEY")
        if response.status_code == 429:
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS[attempt])
                continue
            raise EdamamError("Edamam rate limit hit repeatedly — try syncing again later")
        response.raise_for_status()
        data = response.json()
        return [hit["recipe"] for hit in data.get("hits", [])]


def normalize_recipe(recipe: dict) -> dict:
    """Recipe macros/calories are reported for the *whole recipe* — divide
    by yield (servings) to get the per-serving numbers this app actually
    tracks everywhere else."""
    servings = recipe.get("yield") or 1
    nutrients = recipe.get("totalNutrients", {})

    def per_serving(key: str) -> float:
        entry = nutrients.get(key)
        return (entry["quantity"] / servings) if entry else 0.0

    return {
        "name": recipe.get("label", "Recipe"),
        "url": recipe.get("url"),
        "uri": recipe.get("uri"),
        "ingredients": recipe.get("ingredientLines", []),
        "kcal": round(per_serving("ENERC_KCAL")),
        "protein": round(per_serving("PROCNT"), 1),
        "carbs": round(per_serving("CHOCDF"), 1),
        "fat": round(per_serving("FAT"), 1),
        "fiber": round(per_serving("FIBTG"), 1),
    }
