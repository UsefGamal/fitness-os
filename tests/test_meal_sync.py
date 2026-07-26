"""Meal-plan sync tests use a stubbed Spoonacular client (monkeypatched)
rather than the real API — there's no real SPOONACULAR_API_KEY available
in this environment, and even if there were, tests shouldn't burn a
third party's rate limit. The stub returns enough fake recipes to
exercise the full sync -> DB -> get_active_day()/shopping-list path."""

import pytest

from content import meal_sync
from content.spoonacular_client import SpoonacularError
from database import engine
from models import MealPlanSync, SyncedMealOption
from sqlmodel import Session, select


def _fake_recipe(i: int, kcal: float, protein: float, carbs: float, fat: float) -> dict:
    return {
        "recipe_id": i,
        "title": f"Fake Recipe {i}",
        "image_url": f"https://example.com/{i}.jpg",
        "source_url": f"https://example.com/recipes/{i}",
        "kcal": kcal,
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
        "fiber": 3.0,
    }


def _stub_search_recipes(min_kcal, max_kcal, min_protein, max_protein, min_carbs, max_carbs, min_fat, max_fat, number=20, exclude_ingredients=""):
    mid_kcal = (min_kcal + max_kcal) / 2
    mid_protein = (min_protein + max_protein) / 2
    mid_carbs = (min_carbs + max_carbs) / 2
    mid_fat = (min_fat + max_fat) / 2
    return [_fake_recipe(i, mid_kcal, mid_protein, mid_carbs, mid_fat) for i in range(1, 9)]


def _stub_get_recipe_ingredients(recipe_id):
    return [
        {"name": "chicken breast", "amount": 200, "unit": "g", "aisle": "Meat"},
        {"name": "olive oil", "amount": 1, "unit": "tbsp", "aisle": "Oil, Vinegar, Salad Dressing"},
    ]


def _stub_search_recipes_too_few(*args, **kwargs):
    return [_fake_recipe(1, 400, 30, 40, 15)]


@pytest.fixture(autouse=True)
def stub_spoonacular(monkeypatch):
    monkeypatch.setattr(meal_sync, "search_recipes", _stub_search_recipes)
    monkeypatch.setattr(meal_sync, "get_recipe_ingredients", _stub_get_recipe_ingredients)


def test_run_sync_populates_all_140_cells(auth_client):
    with Session(engine) as session:
        sync = meal_sync.run_sync(session)
        assert sync.id is not None
        rows = session.exec(select(SyncedMealOption).where(SyncedMealOption.sync_id == sync.id)).all()
        assert len(rows) == 14 * 5 * 2  # 14 days x 5 slots x 2 options


def test_run_sync_replaces_previous_sync_not_accumulates(auth_client):
    with Session(engine) as session:
        meal_sync.run_sync(session)
        second = meal_sync.run_sync(session)

        all_syncs = session.exec(select(MealPlanSync)).all()
        assert len(all_syncs) == 1
        assert all_syncs[0].id == second.id

        all_options = session.exec(select(SyncedMealOption)).all()
        assert len(all_options) == 14 * 5 * 2
        assert all(opt.sync_id == second.id for opt in all_options)


def test_get_active_day_uses_synced_plan_after_sync(auth_client):
    with Session(engine) as session:
        meal_sync.run_sync(session)
        day = meal_sync.get_active_day(session, 1)
        assert "Synced" in day["label"]
        breakfast = next(m for m in day["meals"] if m["slot"] == "breakfast")
        assert len(breakfast["options"]) == 2
        assert breakfast["options"][0]["title"].startswith("Fake Recipe")


def test_get_active_day_falls_back_to_static_plan_without_sync(auth_client):
    with Session(engine) as session:
        day = meal_sync.get_active_day(session, 1)
        assert "Synced" not in day["label"]


def test_sync_failure_raises_spoonacular_error(monkeypatch, auth_client):
    monkeypatch.setattr(meal_sync, "search_recipes", _stub_search_recipes_too_few)
    with Session(engine) as session:
        with pytest.raises(SpoonacularError):
            meal_sync.run_sync(session)
        # nothing should have been committed
        assert session.exec(select(MealPlanSync)).first() is None


def test_sync_route_success_shows_confirmation(auth_client):
    r = auth_client.post("/meals/sync")  # follows the redirect to /more?synced=1
    assert r.status_code == 200
    assert "Meal plan synced." in r.text
    assert "Last synced" in r.text


def test_sync_route_failure_redirects_with_error(monkeypatch, auth_client):
    monkeypatch.setattr(meal_sync, "search_recipes", _stub_search_recipes_too_few)
    r = auth_client.post("/meals/sync", headers={"referer": "http://testserver/more"})
    assert "error=" in str(r.url)


def test_shopping_list_uses_synced_ingredients_after_sync(auth_client):
    with Session(engine) as session:
        meal_sync.run_sync(session)
    r = auth_client.get("/meals/shopping-list")
    assert r.status_code == 200
    assert "Chicken Breast" in r.text
    assert "Olive Oil" in r.text


def test_meals_page_works_after_sync(auth_client):
    with Session(engine) as session:
        meal_sync.run_sync(session)
    r = auth_client.get("/meals")
    assert r.status_code == 200
    assert "Fake Recipe" in r.text
