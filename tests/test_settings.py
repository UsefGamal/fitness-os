def _valid_payload(**overrides):
    payload = {
        "height_cm": 175,
        "date_of_birth": "1999-01-01",
        "goal_weight_low_kg": 75,
        "goal_weight_high_kg": 80,
        "goal_date": "2027-01-01",
        "fitness_level": "intermediate",
        "start_weight_kg": 100,
    }
    payload.update(overrides)
    return payload


def test_update_settings_success(auth_client):
    r = auth_client.post("/settings", data=_valid_payload())
    assert r.status_code == 200
    assert "Saved." in r.text


def test_goal_low_above_high_rejected(auth_client):
    r = auth_client.post(
        "/settings",
        data=_valid_payload(goal_weight_low_kg=90, goal_weight_high_kg=80),
        headers={"referer": "http://testserver/settings"},
    )
    assert "error=" in str(r.url)


def test_invalid_fitness_level_rejected(auth_client):
    r = auth_client.post(
        "/settings",
        data=_valid_payload(fitness_level="expert_mode"),
        headers={"referer": "http://testserver/settings"},
    )
    assert "error=" in str(r.url)


def test_date_of_birth_in_future_rejected(auth_client):
    r = auth_client.post(
        "/settings", data=_valid_payload(date_of_birth="2099-01-01"), headers={"referer": "http://testserver/settings"}
    )
    assert "error=" in str(r.url)


def test_height_out_of_range_rejected(auth_client):
    r = auth_client.post(
        "/settings", data=_valid_payload(height_cm=5), headers={"referer": "http://testserver/settings"}
    )
    assert "error=" in str(r.url)
