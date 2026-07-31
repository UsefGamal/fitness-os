"""Regression coverage for database.py's light-migration mechanism —
this is where a real production outage came from once (a SQLite-lenient
`BOOLEAN DEFAULT 0` that Postgres rejected outright)."""

import sqlite3

from sqlalchemy import inspect
from sqlmodel import SQLModel

import models  # noqa: F401  (ensures models are registered before create_all)
from database import DATABASE_URL, _LIGHT_MIGRATIONS, _drop_stale_mealplansync_table, engine, run_light_migrations


def test_light_migrations_idempotent_and_add_missing_columns():
    raw_path = DATABASE_URL.replace("sqlite:///", "")
    conn = sqlite3.connect(raw_path)
    conn.execute("DROP TABLE IF EXISTS workout")
    conn.execute(
        "CREATE TABLE workout (id INTEGER PRIMARY KEY, log_date DATE, workout_type VARCHAR, "
        "duration_min INTEGER, notes VARCHAR)"
    )
    conn.commit()
    conn.close()

    # Must succeed when run twice in a row without error (idempotent).
    run_light_migrations()
    run_light_migrations()

    columns = {col["name"] for col in inspect(engine).get_columns("workout")}
    for expected in ("session_rpe", "is_deload", "pain_note", "result"):
        assert expected in columns


def test_stale_mealplansync_table_from_old_schema_is_dropped_and_recreated():
    """Regression guard for a real production outage: the reverted
    Spoonacular meal-sync feature left a `mealplansync` table behind with
    a different schema (no `requested_at` column). create_all() only
    creates *missing* tables, so it silently kept the stale columns until
    _drop_stale_mealplansync_table() started clearing it out first."""
    raw_path = DATABASE_URL.replace("sqlite:///", "")
    conn = sqlite3.connect(raw_path)
    conn.execute("DROP TABLE IF EXISTS mealplansync")
    conn.execute("CREATE TABLE mealplansync (id INTEGER PRIMARY KEY, spoonacular_meal_plan_id VARCHAR, synced_at DATE)")
    conn.commit()
    conn.close()

    _drop_stale_mealplansync_table()  # should drop the old-shape table...
    SQLModel.metadata.create_all(engine)  # ...so this recreates it with the current schema

    columns = {col["name"] for col in inspect(engine).get_columns("mealplansync")}
    assert "requested_at" in columns
    assert "spoonacular_meal_plan_id" not in columns


def test_light_migrations_never_use_sqlite_only_boolean_syntax():
    """`BOOLEAN DEFAULT 0`/`DEFAULT 1` is silently accepted by SQLite's
    dynamic typing but rejected by Postgres (which needs `DEFAULT false`/
    `true`) — this is a regression guard for that exact production bug."""
    for statement in _LIGHT_MIGRATIONS:
        if "BOOLEAN" in statement.upper():
            upper = statement.upper()
            assert "DEFAULT 0" not in upper and "DEFAULT 1" not in upper, statement
