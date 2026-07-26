"""CRUD coverage for the simpler session types — cardio, padel, home,
recovery. Gym has its own richer test_gym.py (nested sets)."""

import re
from datetime import date


def test_cardio_create_edit_delete(auth_client):
    today = date.today().isoformat()
    r = auth_client.post("/cardio", data={"log_date": today, "duration_min": 22, "session_rpe": 6})
    assert r.status_code == 200
    assert "22 min" in r.text

    workout_id = re.search(r"/cardio/(\d+)/delete", r.text).group(1)
    r = auth_client.post(
        "/cardio", data={"workout_id": workout_id, "log_date": today, "duration_min": 30, "notes": "faster pace"}
    )
    assert "30 min" in r.text
    assert "faster pace" in r.text

    r = auth_client.post(f"/cardio/{workout_id}/delete", follow_redirects=False)
    assert r.status_code == 303
    r = auth_client.get("/cardio")
    assert "No cardio sessions logged yet." in r.text


def test_cardio_duration_out_of_range_rejected(auth_client):
    r = auth_client.post(
        "/cardio",
        data={"log_date": date.today().isoformat(), "duration_min": 0},
        headers={"referer": "http://testserver/cardio"},
    )
    assert "error=" in str(r.url)


def test_padel_create_edit_delete_and_result_choice(auth_client):
    today = date.today().isoformat()
    r = auth_client.post("/padel", data={"log_date": today, "duration_min": 90, "result": "win"})
    assert "Win" in r.text

    workout_id = re.search(r"/padel/(\d+)/delete", r.text).group(1)
    r = auth_client.post(
        "/padel", data={"workout_id": workout_id, "log_date": today, "duration_min": 90, "result": "loss"}
    )
    assert "Loss" in r.text

    r = auth_client.post(f"/padel/{workout_id}/delete", follow_redirects=False)
    assert r.status_code == 303


def test_padel_invalid_result_rejected(auth_client):
    r = auth_client.post(
        "/padel",
        data={"log_date": date.today().isoformat(), "duration_min": 90, "result": "tie"},
        headers={"referer": "http://testserver/padel"},
    )
    assert "error=" in str(r.url)


def test_home_create_and_delete(auth_client):
    r = auth_client.post("/home/new", data={"log_date": date.today().isoformat()}, follow_redirects=False)
    assert r.status_code == 303
    home_url = r.headers["location"]
    r = auth_client.post(f"{home_url}/delete", follow_redirects=False)
    assert r.status_code == 303
    assert r.headers["location"] == "/home"


def test_recovery_create_and_delete(auth_client):
    r = auth_client.post("/recovery/new", data={"log_date": date.today().isoformat()}, follow_redirects=False)
    assert r.status_code == 303
    rec_url = r.headers["location"]
    r = auth_client.post(f"{rec_url}/delete", follow_redirects=False)
    assert r.status_code == 303
    assert r.headers["location"] == "/recovery"
