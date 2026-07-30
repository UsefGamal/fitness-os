def test_daily_quest_toggle(auth_client):
    r = auth_client.post("/bonus/toggle", data={"task_key": "hydration"})
    assert r.status_code == 200
    assert r.text.count("quest-done") >= 1


def test_weekly_quest_cannot_be_toggled_by_hand(auth_client):
    r = auth_client.post(
        "/bonus/toggle",
        data={"task_key": "three_sessions_week"},
        headers={"referer": "http://testserver/bonus"},
    )
    assert "error=" in str(r.url)


def test_once_quest_cannot_be_toggled_by_hand(auth_client):
    r = auth_client.post(
        "/bonus/toggle",
        data={"task_key": "first_5kg"},
        headers={"referer": "http://testserver/bonus"},
    )
    assert "error=" in str(r.url)


def test_invalid_task_key_rejected(auth_client):
    r = auth_client.post(
        "/bonus/toggle", data={"task_key": "not_a_real_quest"}, headers={"referer": "http://testserver/bonus"}
    )
    assert "error=" in str(r.url)


def test_points_total_increments(auth_client):
    r0 = auth_client.get("/bonus")
    auth_client.post("/bonus/toggle", data={"task_key": "hydration"})  # +5 pts
    r1 = auth_client.get("/bonus")
    assert r0.text != r1.text
