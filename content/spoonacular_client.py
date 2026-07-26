"""Thin wrapper around the Spoonacular recipe API — the only place in the
project that knows Spoonacular's request/response shape. Everything here
is defensive: a malformed or unexpected field on one recipe gets that
recipe skipped rather than crashing the whole sync, since a periodic
best-effort refresh isn't worth taking the app's meal plan down over.
"""

import os
from typing import Optional

import httpx

SPOONACULAR_API_KEY = os.getenv("SPOONACULAR_API_KEY", "")
BASE_URL = "https://api.spoonacular.com"
REQUEST_TIMEOUT = 20


class SpoonacularError(Exception):
    pass


def _extract_nutrient(nutrients: list, name: str) -> Optional[float]:
    for n in nutrients or []:
        if str(n.get("name", "")).lower() == name.lower():
            try:
                return float(n.get("amount"))
            except (TypeError, ValueError):
                return None
    return None


def search_recipes(
    min_kcal: float,
    max_kcal: float,
    min_protein: float,
    max_protein: float,
    min_carbs: float,
    max_carbs: float,
    min_fat: float,
    max_fat: float,
    number: int = 20,
    exclude_ingredients: str = "",
) -> list[dict]:
    """One dict per matching recipe: recipe_id, title, image_url,
    source_url, kcal, protein, carbs, fat, fiber. Recipes whose nutrition
    couldn't be parsed are silently omitted."""
    if not SPOONACULAR_API_KEY:
        raise SpoonacularError("SPOONACULAR_API_KEY is not configured")

    params = {
        "apiKey": SPOONACULAR_API_KEY,
        "number": number,
        "addRecipeNutrition": "true",
        "minCalories": min_kcal,
        "maxCalories": max_kcal,
        "minProtein": min_protein,
        "maxProtein": max_protein,
        "minCarbs": min_carbs,
        "maxCarbs": max_carbs,
        "minFat": min_fat,
        "maxFat": max_fat,
        "sort": "random",
    }
    if exclude_ingredients:
        params["excludeIngredients"] = exclude_ingredients

    try:
        response = httpx.get(f"{BASE_URL}/recipes/complexSearch", params=params, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPError as exc:
        raise SpoonacularError(f"Spoonacular request failed: {exc}") from exc

    recipes = []
    for item in data.get("results", []):
        nutrition = item.get("nutrition") or {}
        nutrients = nutrition.get("nutrients") or []
        kcal = _extract_nutrient(nutrients, "Calories")
        protein = _extract_nutrient(nutrients, "Protein")
        carbs = _extract_nutrient(nutrients, "Carbohydrates")
        fat = _extract_nutrient(nutrients, "Fat")
        fiber = _extract_nutrient(nutrients, "Fiber") or 0.0
        recipe_id = item.get("id")
        if recipe_id is None or None in (kcal, protein, carbs, fat):
            continue
        recipes.append(
            {
                "recipe_id": recipe_id,
                "title": item.get("title") or "Recipe",
                "image_url": item.get("image"),
                "source_url": item.get("sourceUrl"),
                "kcal": round(kcal, 1),
                "protein": round(protein, 1),
                "carbs": round(carbs, 1),
                "fat": round(fat, 1),
                "fiber": round(fiber, 1),
            }
        )
    return recipes


def get_recipe_ingredients(recipe_id: int) -> list[dict]:
    """[{"name","amount","unit","aisle"}] for a recipe's shopping-list
    ingredients. Returns [] on any failure — a missing ingredient list for
    one recipe shouldn't break the rest of the sync."""
    if not SPOONACULAR_API_KEY:
        return []
    try:
        response = httpx.get(
            f"{BASE_URL}/recipes/{recipe_id}/information",
            params={"apiKey": SPOONACULAR_API_KEY, "includeNutrition": "false"},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
    except httpx.HTTPError:
        return []

    ingredients = []
    for ing in data.get("extendedIngredients") or []:
        name = ing.get("nameClean") or ing.get("name")
        amount = ing.get("amount")
        if not name or amount is None:
            continue
        try:
            amount = round(float(amount), 2)
        except (TypeError, ValueError):
            continue
        ingredients.append({"name": name, "amount": amount, "unit": ing.get("unit") or "", "aisle": ing.get("aisle") or ""})
    return ingredients
