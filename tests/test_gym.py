import re
from datetime import date


def _create_session(client):
    r = client.post("/gym/new", data={"log_date": date.today().isoformat()}, follow_redirects=False)
    assert r.status_code == 303
    return r.headers["location"]


def _first_exercise_id(client, gym_url):
    r = client.get(gym_url)
    return re.search(r'<option value="(\d+)"', r.text).group(1)


def test_create_session_and_add_set(auth_client):
    gym_url = _create_session(auth_client)
    ex_id = _first_exercise_id(auth_client, gym_url)
    r = auth_client.post(f"{gym_url}/sets", data={"exercise_id": ex_id, "reps": 8, "weight_kg": 40, "rpe": 7})
    assert r.status_code == 200
    assert "40.0 kg" in r.text or "40 kg" in r.text


def test_set_rpe_out_of_range_rejected(auth_client):
    gym_url = _create_session(auth_client)
    ex_id = _first_exercise_id(auth_client, gym_url)
    r = auth_client.post(
        f"{gym_url}/sets",
        data={"exercise_id": ex_id, "reps": 8, "weight_kg": 40, "rpe": 15},
        headers={"referer": f"http://testserver{gym_url}"},
    )
    assert "error=" in str(r.url)


def test_set_nonexistent_exercise_rejected(auth_client):
    gym_url = _create_session(auth_client)
    r = auth_client.post(
        f"{gym_url}/sets",
        data={"exercise_id": 999999, "reps": 8, "weight_kg": 40},
        headers={"referer": f"http://testserver{gym_url}"},
    )
    assert "error=" in str(r.url)


def test_delete_set(auth_client):
    gym_url = _create_session(auth_client)
    ex_id = _first_exercise_id(auth_client, gym_url)
    auth_client.post(f"{gym_url}/sets", data={"exercise_id": ex_id, "reps": 8, "weight_kg": 40})
    r = auth_client.get(gym_url)
    set_id = re.search(r"/sets/(\d+)/delete", r.text).group(1)
    r = auth_client.post(f"{gym_url}/sets/{set_id}/delete", follow_redirects=False)
    assert r.status_code == 303
    r = auth_client.get(gym_url)
    assert "No sets logged yet." in r.text


def test_delete_session_removes_it_and_its_sets(auth_client):
    gym_url = _create_session(auth_client)
    ex_id = _first_exercise_id(auth_client, gym_url)
    auth_client.post(f"{gym_url}/sets", data={"exercise_id": ex_id, "reps": 8, "weight_kg": 40})
    r = auth_client.post(f"{gym_url}/delete", follow_redirects=False)
    assert r.status_code == 303
    assert r.headers["location"] == "/gym"
    r = auth_client.get(gym_url)
    assert r.status_code == 404


def test_session_duration_out_of_range_rejected(auth_client):
    r = auth_client.post(
        "/gym/new",
        data={"log_date": date.today().isoformat(), "duration_min": 5000},
        headers={"referer": "http://testserver/gym"},
    )
    assert "error=" in str(r.url)


def test_progress_page_has_no_data_states_when_empty(auth_client):
    r = auth_client.get("/gym/progress")
    assert r.status_code == 200
    assert "Log a couple of gym sessions" in r.text
    assert "Log RPE on a few sets" in r.text
    assert "Log the same exercise across 2+ sessions" in r.text
    assert "log-table" not in r.text


def test_progress_page_charts_have_accessibility_twin_tables(auth_client):
    """Regression guard: every chart on /gym/progress (session volume,
    RPE trend, per-exercise strength) must be paired with a table of the
    same underlying data, per charting.py's own accessibility-twin
    convention — this page used to render three charts with no table
    anywhere on it."""
    r1 = auth_client.post("/gym/new", data={"log_date": "2026-08-10"}, follow_redirects=False)
    gym_url_1 = r1.headers["location"]
    ex_id = _first_exercise_id(auth_client, gym_url_1)
    auth_client.post(f"{gym_url_1}/sets", data={"exercise_id": ex_id, "reps": 10, "weight_kg": 20, "rpe": 7})

    r2 = auth_client.post("/gym/new", data={"log_date": "2026-08-13"}, follow_redirects=False)
    gym_url_2 = r2.headers["location"]
    auth_client.post(f"{gym_url_2}/sets", data={"exercise_id": ex_id, "reps": 10, "weight_kg": 25, "rpe": 8})

    r = auth_client.get("/gym/progress")
    assert r.status_code == 200

    # Three accessibility-twin tables: session volume, RPE trend, strength.
    assert r.text.count("log-table") == 3
    assert "Volume (kg)" in r.text
    assert "Avg RPE" in r.text
    assert "Top set (kg)" in r.text

    # The actual logged values show up in a table cell, not just the SVG.
    assert "2026-08-10" in r.text
    assert "2026-08-13" in r.text
    assert "25.0" in r.text  # top set weight for the second session
    assert "8.0" in r.text  # RPE for the second session
