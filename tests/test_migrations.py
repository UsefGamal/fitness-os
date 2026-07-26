"""Regression coverage for database.py's light-migration mechanism —
this is where a real production outage came from once (a SQLite-lenient
`BOOLEAN DEFAULT 0` that Postgres rejected outright)."""

import sqlite3

from sqlalchemy import inspect

from database import DATABASE_URL, _LIGHT_MIGRATIONS, engine, run_light_migrations


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


def test_light_migrations_never_use_sqlite_only_boolean_syntax():
    """`BOOLEAN DEFAULT 0`/`DEFAULT 1` is silently accepted by SQLite's
    dynamic typing but rejected by Postgres (which needs `DEFAULT false`/
    `true`) — this is a regression guard for that exact production bug."""
    for statement in _LIGHT_MIGRATIONS:
        if "BOOLEAN" in statement.upper():
            upper = statement.upper()
            assert "DEFAULT 0" not in upper and "DEFAULT 1" not in upper, statement
