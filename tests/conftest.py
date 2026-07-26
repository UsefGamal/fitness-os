"""Shared pytest fixtures for the whole suite.

Sets test-only env vars *before* importing the app (main.py/database.py
read DATABASE_URL/APP_PASSWORD/etc. at module-import time), so the test
suite never touches whatever real database or password is configured in
.env — it always runs against its own temp SQLite file.
"""

import os
import sys
import tempfile
from pathlib import Path

import pytest

_TEST_DB_PATH = Path(tempfile.gettempdir()) / "fitness_os_pytest.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH}"
os.environ["APP_PASSWORD"] = "test-password"
os.environ["SESSION_SECRET"] = "test-session-secret"
os.environ["CRON_SECRET"] = "test-cron-secret"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402

import auth  # noqa: E402
import main  # noqa: E402
from database import engine  # noqa: E402

TEST_PASSWORD = "test-password"
TEST_CRON_SECRET = "test-cron-secret"


@pytest.fixture(autouse=True)
def fresh_db():
    """Every test starts with an empty, freshly-migrated database — the
    TestClient's startup event (init_db) recreates tables and reseeds the
    Profile row and Exercise library on each `with TestClient(...)` use."""
    SQLModel.metadata.drop_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def reset_login_rate_limiter():
    """auth.py's rate limiter is deliberately global in-memory state (see
    its own docstring) — that's correct for the running app but would
    otherwise leak lockouts between unrelated tests."""
    auth._failed_login_times.clear()
    yield
    auth._failed_login_times.clear()


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        yield c


@pytest.fixture
def auth_client(client):
    r = client.post("/login", data={"password": TEST_PASSWORD})
    assert r.status_code == 200
    return client


@pytest.fixture
def test_password():
    return TEST_PASSWORD


@pytest.fixture
def test_cron_secret():
    return TEST_CRON_SECRET
