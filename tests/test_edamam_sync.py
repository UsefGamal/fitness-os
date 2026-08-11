"""Exercises edamam_sync.py's orchestration and adapter against a
stubbed edamam_client — no real network calls, no real Edamam quota
spent. Stubs are monkeypatched onto edamam_sync's own module namespace,
since it imports the client functions by name."""

import json
from datetime import datetime, timedelta

import pytest
from sqlmodel import Session, select

import edamam_sync
from database import engine
from edamam_client import EdamamError
from models import EdamamPlanSync


def _fake_recipe(uri, name, kcal, protein, carbs, fat, fiber, servings=1):
    return {
        "uri": uri,
        "label": name,
        "url": f"https://example.com/{uri}",
        "yield": servings,
        "ingredientLines": [f"1 serving of {name}"],
        "totalNutrients": {
            "ENERC_KCAL": {"quantity": kcal * servings, "unit": "kcal"},
            "PROCNT": {"quantity": protein * servings, "unit": "g"},
            "CHOCDF": {"quantity": carbs * servings, "unit": "g"},
            "FAT": {"quantity": fat * servings, "unit": "g"},
            "FIBTG": {"quantity": fiber * servings, "unit": "g"},
        },
    }


def _run_full_sync(db: Session) -> EdamamPlanSync:
    """Mirrors what the route does — start_sync() then the background
    task — but runs the "background" part inline since there's no actual
    background worker in a test."""
    sync = edamam_sync.start_sync(db)
    edamam_sync.run_sync_in_background(sync.id)
    db.refresh(sync)
    return sync


@pytest.fixture
def stub_edamam(client, monkeypatch):
    """client fixture (unused directly) forces schema creation via
    TestClient's lifespan before these direct-DB tests run."""
    monkeypatch.setattr(edamam_sync.time, "sleep", lambda _seconds: None)
    calls = []

    def fake_search_recipes(*, query, **kwargs):
        calls.append({"query": query, **kwargs})
        # A small varied pool so cycling across 14 days has something to work with.
        return [
            _fake_recipe(f"{query}-{i}", f"{query.title()} {i}", 400, 30, 40, 12, 5)
            for i in range(3)
        ]

    monkeypatch.setattr(edamam_sync, "search_recipes", fake_search_recipes)
    return calls


def test_start_sync_creates_pending_row(client):
    with Session(engine) as db:
        sync = edamam_sync.start_sync(db)
        assert sync.status == "pending"
        assert sync.plan_json is None


def test_run_sync_produces_14_days_with_2_options_each(stub_edamam):
    with Session(engine) as db:
        sync = _run_full_sync(db)
        assert sync.status == "complete"

        plan = json.loads(sync.plan_json)
        assert len(plan) == 14
        for day in plan:
            for slot in ("breakfast", "snack1", "lunch", "snack2", "dinner"):
                assert "option_a" in day["meals"][slot]
                assert "option_b" in day["meals"][slot]
        assert plan[13]["is_refeed"] is True
        assert plan[0]["is_refeed"] is False


def test_run_sync_builds_shopping_list_from_ingredient_lines(stub_edamam):
    with Session(engine) as db:
        sync = _run_full_sync(db)
        products = json.loads(sync.products_json)
        assert len(products) > 0
        assert all("name" in p and "quantity" in p for p in products)


def test_run_sync_marks_error_when_a_slot_has_no_recipes(client, monkeypatch):
    monkeypatch.setattr(edamam_sync.time, "sleep", lambda _seconds: None)

    def empty_search(*, query, **kwargs):
        return []

    monkeypatch.setattr(edamam_sync, "search_recipes", empty_search)
    with Session(engine) as db:
        sync = _run_full_sync(db)
        assert sync.status == "error"
        assert "No recipes found" in sync.error_detail


def test_run_sync_marks_error_on_client_failure(client, monkeypatch):
    monkeypatch.setattr(edamam_sync.time, "sleep", lambda _seconds: None)

    def boom(*, query, **kwargs):
        raise EdamamError("simulated failure")

    monkeypatch.setattr(edamam_sync, "search_recipes", boom)
    with Session(engine) as db:
        sync = _run_full_sync(db)
        assert sync.status == "error"
        assert "simulated failure" in sync.error_detail


def test_get_active_day_falls_back_to_static_with_no_sync(client):
    with Session(engine) as db:
        day = edamam_sync.get_active_day(db, 1)
        assert day["meals"][0]["options"][0]["cuisine"] != "Edamam"


def test_get_active_day_uses_completed_sync(stub_edamam):
    with Session(engine) as db:
        _run_full_sync(db)
        day = edamam_sync.get_active_day(db, 1)
        assert day["meals"][0]["options"][0]["cuisine"] == "Edamam"
        assert day["totals"]["kcal"] > 0


def test_get_active_shopping_products_none_until_synced(client):
    with Session(engine) as db:
        assert edamam_sync.get_active_shopping_products(db) is None


def test_latest_sync_returns_most_recent_row(stub_edamam):
    with Session(engine) as db:
        _run_full_sync(db)
        _run_full_sync(db)
        latest = edamam_sync.latest_sync(db)
        all_rows = db.exec(select(EdamamPlanSync)).all()
        assert len(all_rows) == 2
        assert latest.id == max(r.id for r in all_rows)


def test_trigger_edamam_sync_route(auth_client, stub_edamam):
    r = auth_client.post("/meals/edamam-sync", follow_redirects=False)
    assert r.status_code == 303
    r2 = auth_client.get("/more")
    assert "Last synced" in r2.text


def test_trigger_edamam_sync_route_does_not_double_start(auth_client, stub_edamam):
    """A pending sync shouldn't be restarted by a second click — but since
    TestClient runs background tasks synchronously, the first request's
    sync is already 'complete' by the time this assertion runs, so this
    mainly guards the "existing.status in (complete, error)" gate itself
    rather than a true overlap race."""
    auth_client.post("/meals/edamam-sync")
    auth_client.post("/meals/edamam-sync")
    with Session(engine) as db:
        rows = db.exec(select(EdamamPlanSync)).all()
        assert len(rows) == 2  # each POST completed before the next one started


def test_is_pending_stale_regression_guard():
    """A background task has no durability guarantee -- if the process
    dies mid-sync (a restart, a deploy, a free-tier spin-down), the row
    is orphaned in 'pending' forever with nothing left running to finish
    it. This is a real regression: it happened during development when a
    local server restart killed an in-flight sync, and the trigger route
    then refused to ever start a new one because 'pending' didn't match
    its (complete, error) allow-list."""
    fresh_pending = EdamamPlanSync(status="pending", requested_at=datetime.utcnow())
    assert edamam_sync.is_pending_stale(fresh_pending) is False

    old_pending = EdamamPlanSync(
        status="pending",
        requested_at=datetime.utcnow() - timedelta(minutes=edamam_sync.PENDING_TIMEOUT_MINUTES + 1),
    )
    assert edamam_sync.is_pending_stale(old_pending) is True

    old_complete = EdamamPlanSync(
        status="complete",
        requested_at=datetime.utcnow() - timedelta(minutes=edamam_sync.PENDING_TIMEOUT_MINUTES + 1),
    )
    assert edamam_sync.is_pending_stale(old_complete) is False  # finished, not stale


def test_trigger_edamam_sync_route_recovers_from_stale_pending(auth_client, stub_edamam):
    with Session(engine) as db:
        stale = EdamamPlanSync(
            status="pending",
            requested_at=datetime.utcnow() - timedelta(minutes=edamam_sync.PENDING_TIMEOUT_MINUTES + 1),
        )
        db.add(stale)
        db.commit()

    r = auth_client.post("/meals/edamam-sync", follow_redirects=False)
    assert r.status_code == 303
    r2 = auth_client.get("/more")
    assert "Last synced" in r2.text  # the new sync actually ran, wasn't blocked by the stale row
