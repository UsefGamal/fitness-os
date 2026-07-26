from datetime import date


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
