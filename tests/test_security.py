def test_security_headers_present(client):
    r = client.get("/login")
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "script-src 'self'" in r.headers["content-security-policy"]
    assert r.headers["cache-control"].startswith("no-store")


def test_static_assets_not_marked_no_store(client):
    r = client.get("/static/app.js")
    assert r.headers.get("cache-control") is None or "no-store" not in r.headers["cache-control"]


def test_no_inline_event_handlers_in_delete_forms(auth_client):
    """Regression guard: the CSP is script-src 'self', so any onclick=/
    onsubmit= attribute anywhere would silently stop working in a real
    browser. Confirm-before-delete must go through the .confirm-delete
    class + app.js instead."""
    from datetime import date

    auth_client.post("/body", data={"log_date": date.today().isoformat(), "weight_kg": 90})
    r = auth_client.get("/body")
    assert "onsubmit=" not in r.text
    assert "onclick=" not in r.text
    assert "confirm-delete" in r.text


def test_cron_endpoint_rejects_missing_secret(client):
    r = client.get("/cron/daily-digest")
    assert r.status_code == 403


def test_cron_endpoint_rejects_wrong_secret(client):
    r = client.get("/cron/daily-digest", params={"secret": "wrong"})
    assert r.status_code == 403


def test_cron_endpoint_accepts_query_param_secret(client, test_cron_secret):
    r = client.get("/cron/daily-digest", params={"secret": test_cron_secret})
    assert r.status_code == 200  # auth passed; body may report a send error, that's fine here


def test_cron_endpoint_accepts_header_secret(client, test_cron_secret):
    r = client.get("/cron/daily-digest", headers={"X-Cron-Secret": test_cron_secret})
    assert r.status_code == 200


def test_healthz_no_auth_required(client):
    r = client.get("/healthz")
    assert r.status_code == 200
