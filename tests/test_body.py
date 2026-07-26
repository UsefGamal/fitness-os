from datetime import date, timedelta


def test_create_and_read_body_log(auth_client):
    today = date.today().isoformat()
    r = auth_client.post("/body", data={"log_date": today, "weight_kg": 95.5})
    assert r.status_code == 200
    assert "95.5" in r.text


def test_posting_same_date_updates_instead_of_duplicating(auth_client):
    today = date.today().isoformat()
    auth_client.post("/body", data={"log_date": today, "weight_kg": 95.5})
    r = auth_client.post("/body", data={"log_date": today, "weight_kg": 94.0})
    assert r.status_code == 200
    assert "94.0" in r.text
    assert r.text.count("row-edit-btn") == 1  # still exactly one history row, not two


def test_edit_prefill(auth_client):
    today = date.today().isoformat()
    auth_client.post("/body", data={"log_date": today, "weight_kg": 95.5, "notes": "felt good"})
    r = auth_client.get("/body")
    log_id = r.text.split("/body?edit=")[1].split('"')[0]
    r = auth_client.get(f"/body?edit={log_id}")
    assert 'value="95.5"' in r.text
    assert 'value="felt good"' in r.text


def test_delete_body_log(auth_client):
    today = date.today().isoformat()
    auth_client.post("/body", data={"log_date": today, "weight_kg": 95.5})
    r = auth_client.get("/body")
    log_id = r.text.split("/body/")[1].split("/delete")[0]
    r = auth_client.post(f"/body/{log_id}/delete", follow_redirects=False)
    assert r.status_code == 303
    r = auth_client.get("/body")
    assert "No entries yet." in r.text


def test_weight_out_of_range_rejected(auth_client):
    today = date.today().isoformat()
    r = auth_client.post(
        "/body", data={"log_date": today, "weight_kg": 900}, headers={"referer": "http://testserver/body"}
    )
    assert "error=" in str(r.url)
    r2 = auth_client.get("/body")
    assert "No entries yet." in r2.text  # nothing was actually saved


def test_future_date_rejected(auth_client):
    future = (date.today() + timedelta(days=3)).isoformat()
    r = auth_client.post(
        "/body", data={"log_date": future, "weight_kg": 90}, headers={"referer": "http://testserver/body"}
    )
    assert "error=" in str(r.url)


def test_save_shows_confirmation_banner(auth_client):
    today = date.today().isoformat()
    r = auth_client.post("/body", data={"log_date": today, "weight_kg": 90})
    assert "Saved." in r.text
