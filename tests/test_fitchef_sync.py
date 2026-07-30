"""Exercises fitchef_sync.py's orchestration and adapter against a stubbed
fitchef_client — no real network calls, and definitely no real FitChef
quota spent. Each stub is monkeypatched onto fitchef_sync's own module
namespace, since fitchef_sync imports the client functions by name."""

import json

import pytest
from sqlmodel import Session, select

import fitchef_sync
from database import engine
from fitchef_client import FitChefError
from models import MealPlanSync


def _fake_meal(meal_name, name, kcal_parts, alternatives=None):
    carb, protein, fat, fiber = kcal_parts
    return {
        "name": name,
        "recipeId": "111",
        "mealName": meal_name,
        "nutrition": {"carbohydrate": carb, "protein": protein, "fat": fat, "fiber": fiber},
        "ingredients": [{"name": "Egg", "productId": "prod-1", "unitId": "unit-1", "units": 2}],
        "alternatives": alternatives or [],
    }


def _fake_week_payload(identifier, label_prefix):
    slots = ["breakfast", "snack_morning", "lunch", "snack_afternoon", "dinner", "snack_evening"]
    days = []
    for d in range(7):
        meals = [_fake_meal(slot, f"{label_prefix} {slot} {d}", (20, 15, 5, 3)) for slot in slots]
        days.append({"meals": meals, "nutritionBudget": {}, "score": 1, "timeSpent": 10, "price": 5, "restPrice": 1})
    return {
        "identifier": identifier,
        "days": days,
        "recipeHistory": {"w": [{"d": [{"m": [{"recipeId": 111, "fixed": False}]}]}]},
        "products": [
            {"id": "p1", "name": "Egg", "code": None, "price": 0.25, "quantity": 12, "total": 3.0},
            {"id": "p2", "name": "Olive oil", "code": None, "price": 5.0, "quantity": 1, "total": 5.0},
        ],
        "price": 40,
        "restPrice": 5,
        "score": 100,
        "timeSpent": {"total": 100},
        "weekEngineVersion": "test",
    }


@pytest.fixture
def stub_fitchef(client, monkeypatch):
    """client fixture (unused directly) forces schema creation via
    TestClient's lifespan before these direct-DB tests run."""
    calls = {"request_mealplan": [], "fetch_mealplan": []}

    monkeypatch.setattr(fitchef_sync, "get_access_token", lambda: "fake-token")

    def fake_request_mealplan(token, **kwargs):
        calls["request_mealplan"].append(kwargs)
        return 1000 + len(calls["request_mealplan"])

    def fake_fetch_mealplan(token, identifier):
        calls["fetch_mealplan"].append(identifier)
        return calls.get(f"payload_{identifier}")

    monkeypatch.setattr(fitchef_sync, "request_mealplan", fake_request_mealplan)
    monkeypatch.setattr(fitchef_sync, "fetch_mealplan", fake_fetch_mealplan)
    return calls


def test_start_sync_creates_pending_row(stub_fitchef):
    with Session(engine) as db:
        sync = fitchef_sync.start_sync(db)
        assert sync.status == "week1_pending"
        assert sync.week1_identifier is not None
        assert stub_fitchef["request_mealplan"][0]["excluded_sets"] == ["bacon", "ham"]


def test_advance_sync_noop_while_week1_still_generating(stub_fitchef):
    with Session(engine) as db:
        sync = fitchef_sync.start_sync(db)
        result = fitchef_sync.advance_sync(db, sync)
        assert result.status == "week1_pending"
        assert result.week2_identifier is None


def test_advance_sync_transitions_to_week2_with_recipe_history_and_refeed(stub_fitchef):
    with Session(engine) as db:
        sync = fitchef_sync.start_sync(db)
        stub_fitchef[f"payload_{sync.week1_identifier}"] = _fake_week_payload(sync.week1_identifier, "W1")

        result = fitchef_sync.advance_sync(db, sync)
        assert result.status == "week2_pending"
        assert result.week2_identifier is not None
        assert result.recipe_history is not None

        week2_call = stub_fitchef["request_mealplan"][1]
        assert week2_call["recipe_history"] == result.recipe_history
        assert week2_call["configured_days"] == [{"validOn": [6], "nutrition": fitchef_sync.REFEED_MACROS}]


def test_advance_sync_completes_and_merges_14_days(stub_fitchef):
    with Session(engine) as db:
        sync = fitchef_sync.start_sync(db)
        stub_fitchef[f"payload_{sync.week1_identifier}"] = _fake_week_payload(sync.week1_identifier, "W1")
        sync = fitchef_sync.advance_sync(db, sync)  # -> week2_pending
        stub_fitchef[f"payload_{sync.week2_identifier}"] = _fake_week_payload(sync.week2_identifier, "W2")

        sync = fitchef_sync.advance_sync(db, sync)
        assert sync.status == "complete"
        assert sync.completed_at is not None

        plan = json.loads(sync.plan_json)
        assert len(plan) == 14
        assert plan[0]["day_index"] == 1
        assert plan[13]["day_index"] == 14
        assert plan[13]["is_refeed"] is True
        assert plan[0]["is_refeed"] is False

        products = json.loads(sync.products_json)
        egg = next(p for p in products if p["name"] == "Egg")
        assert egg["quantity"] == 24  # 12 + 12, merged across both weeks


def test_advance_sync_marks_error_on_client_failure(stub_fitchef, monkeypatch):
    with Session(engine) as db:
        sync = fitchef_sync.start_sync(db)

        def boom(token, identifier):
            raise FitChefError("simulated failure")

        monkeypatch.setattr(fitchef_sync, "fetch_mealplan", boom)
        result = fitchef_sync.advance_sync(db, sync)
        assert result.status == "error"
        assert "simulated failure" in result.error_detail


def test_advance_sync_is_noop_once_complete_or_error(stub_fitchef):
    with Session(engine) as db:
        sync = MealPlanSync(status="complete")
        db.add(sync)
        db.commit()
        db.refresh(sync)
        result = fitchef_sync.advance_sync(db, sync)
        assert result.status == "complete"
        assert stub_fitchef["fetch_mealplan"] == []  # never called — short-circuited


def test_get_active_day_falls_back_to_static_plan_with_no_sync(client):
    with Session(engine) as db:
        day = fitchef_sync.get_active_day(db, 1)
        assert day["meals"][0]["options"][0]["cuisine"] != "FitChef"


def test_get_active_day_uses_completed_sync(stub_fitchef):
    with Session(engine) as db:
        sync = fitchef_sync.start_sync(db)
        stub_fitchef[f"payload_{sync.week1_identifier}"] = _fake_week_payload(sync.week1_identifier, "W1")
        sync = fitchef_sync.advance_sync(db, sync)
        stub_fitchef[f"payload_{sync.week2_identifier}"] = _fake_week_payload(sync.week2_identifier, "W2")
        fitchef_sync.advance_sync(db, sync)

        day = fitchef_sync.get_active_day(db, 1)
        assert day["meals"][0]["options"][0]["cuisine"] == "FitChef"
        assert day["meals"][0]["options"][1]["cuisine"] == "FitChef"  # alt falls back to primary when none returned


def test_get_active_shopping_products_none_until_synced(client):
    with Session(engine) as db:
        assert fitchef_sync.get_active_shopping_products(db) is None


def test_trigger_sync_route_does_not_double_start(auth_client, stub_fitchef):
    r1 = auth_client.post("/meals/fitchef-sync", follow_redirects=False)
    assert r1.status_code == 303
    r2 = auth_client.post("/meals/fitchef-sync", follow_redirects=False)
    assert r2.status_code == 303

    with Session(engine) as db:
        rows = db.exec(select(MealPlanSync)).all()
        assert len(rows) == 1  # second POST didn't start a new sync while one's in flight


def test_more_page_shows_pending_status(auth_client, stub_fitchef):
    auth_client.post("/meals/fitchef-sync")
    r = auth_client.get("/more")
    assert "Generating your new 14-day plan" in r.text
