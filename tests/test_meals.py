import json
from datetime import date

from sqlmodel import Session

from database import engine
from models import EdamamPlanSync

_FAKE_SYNCED_DAY = {
    "day_index": 1,
    "label": "Test Day",
    "is_refeed": False,
    "meals": {
        slot: {
            "option_a": {"name": f"{slot} A", "ingredients": ["x"], "kcal": 100, "protein": 1, "carbs": 1, "fat": 1, "fiber": 1},
            "option_b": {"name": f"{slot} B", "ingredients": ["y"], "kcal": 100, "protein": 1, "carbs": 1, "fat": 1, "fiber": 1},
        }
        for slot in ("breakfast", "snack1", "lunch", "snack2", "dinner")
    },
}


def _activate_fake_edamam_sync():
    with Session(engine) as db:
        db.add(
            EdamamPlanSync(
                status="complete",
                plan_json=json.dumps([_FAKE_SYNCED_DAY] * 14),
                products_json="[]",
            )
        )
        db.commit()


def test_shopping_list_merges_same_ingredient_across_portion_sizes(auth_client):
    """The exact bug reported in production: Grilled Chicken Breast 150g
    and 200g variants must consolidate into one line with a real total
    weight, not list as two separate '×N' rows."""
    r = auth_client.get("/meals/shopping-list")
    assert r.status_code == 200
    assert r.text.count("Grilled Chicken Breast<") == 1
    assert "kg" in r.text or "g<" in r.text


def test_shopping_list_grouped_into_categories(auth_client):
    r = auth_client.get("/meals/shopping-list")
    assert "Protein &amp; Mains" in r.text


def test_meal_toggle_marks_completed(auth_client):
    today = date.today().isoformat()
    r = auth_client.post("/meals/toggle", data={"log_date": today, "meal_slot": "breakfast", "option_key": "option_a"})
    assert r.status_code == 200
    assert "meal-done" in r.text


def test_meal_toggle_same_option_untoggles(auth_client):
    today = date.today().isoformat()
    auth_client.post("/meals/toggle", data={"log_date": today, "meal_slot": "breakfast", "option_key": "option_a"})
    r = auth_client.post("/meals/toggle", data={"log_date": today, "meal_slot": "breakfast", "option_key": "option_a"})
    assert "meal-done" not in r.text


def test_meal_toggle_invalid_slot_rejected(auth_client):
    r = auth_client.post(
        "/meals/toggle",
        data={"log_date": date.today().isoformat(), "meal_slot": "midnight_snack", "option_key": "option_a"},
        headers={"referer": "http://testserver/meals"},
    )
    assert "error=" in str(r.url)


def test_hydration_add_updates_meter(auth_client):
    today = date.today().isoformat()
    r = auth_client.post("/meals/hydration", data={"log_date": today, "ml": 500})
    assert r.status_code == 200
    assert "500ml" in r.text or "500 ml" in r.text


def test_no_static_fallback_option_when_static_plan_already_active(auth_client):
    """No sync configured -> /meals is already showing the static plan.
    Offering "the static plan" as a third choice alongside itself would
    just duplicate option A."""
    r = auth_client.get("/meals")
    assert "Static Plan" not in r.text


def test_static_plan_appears_as_third_option_when_a_sync_is_active(auth_client):
    _activate_fake_edamam_sync()
    r = auth_client.get("/meals")
    assert r.status_code == 200
    # 5 slots, each should get exactly one "Static Plan" tagged option.
    assert r.text.count("Static Plan") == 5


def test_static_fallback_option_can_be_logged_as_eaten(auth_client):
    _activate_fake_edamam_sync()
    today = date.today().isoformat()
    r = auth_client.post("/meals/toggle", data={"log_date": today, "meal_slot": "breakfast", "option_key": "option_c"})
    assert r.status_code == 200
    assert "meal-done" in r.text


def test_static_fallback_option_macros_count_toward_daily_totals(auth_client):
    """Regression guard: _daily_macro_totals() (feeds the trend sparklines
    and adherence heatmap) rebuilds each day's plan independently of the
    /meals route's own rendering path — it must also inject the static
    fallback option, or a day where option_c was picked would silently
    contribute zero macros instead of the static option's real values."""
    from routers.meals import _daily_macro_totals

    _activate_fake_edamam_sync()
    today = date.today()
    auth_client.post(
        "/meals/toggle", data={"log_date": today.isoformat(), "meal_slot": "breakfast", "option_key": "option_c"}
    )

    with Session(engine) as db:
        totals = _daily_macro_totals(db, today, today, synced_plan_active=True)
    assert totals[today]["protein"] > 0
