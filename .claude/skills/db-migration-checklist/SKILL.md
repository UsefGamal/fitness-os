---
name: db-migration-checklist
description: Use whenever adding or changing a database column/table in this Fitness OS app — i.e. editing models.py's SQLModel table classes or database.py's _LIGHT_MIGRATIONS list. Walks through the ANSI-SQL-safety and idempotency rules that a real production outage came from once.
---

# DB migration checklist

This app has no Alembic. `SQLModel.metadata.create_all()` only creates brand-new tables — it never adds a column to a table that already exists. Every new column on an existing table goes through `database.py`'s `_LIGHT_MIGRATIONS` list instead, run on every startup. Local dev runs SQLite; production runs Postgres (Neon). A migration that only gets exercised against SQLite can look fine locally and still break prod — that already happened once (`BOOLEAN DEFAULT 0`, which SQLite accepts and Postgres rejects outright).

When adding or editing a migration, work through this in order:

1. **Add the field to the SQLModel class in `models.py` first.** The `_LIGHT_MIGRATIONS` entry is what makes it show up on an *existing* database; the model class is what makes it show up on a fresh one.

2. **Write the `ALTER TABLE ... ADD COLUMN` statement in standard ANSI SQL, not SQLite-lenient syntax.**
   - Booleans: `BOOLEAN DEFAULT false` / `DEFAULT true` — never `DEFAULT 0` / `DEFAULT 1`. SQLite silently accepts the numeric form; Postgres rejects it outright.
   - Strings: `VARCHAR`, with `DEFAULT '...'` in single quotes if a default is needed.
   - Nullable-by-default is fine and usually simplest (existing rows get `NULL`) — only add a `DEFAULT` when the column needs a real value for old rows.

3. **Append it to `_LIGHT_MIGRATIONS` — don't edit or remove existing entries.** The list is a append-only log of every column ever added this way; each statement must stay individually idempotent (safe to run forever on every future startup).

4. **Don't add a bare `except Exception: pass` anywhere in the migration path.** `run_light_migrations()` already distinguishes the expected case (column already exists — either database's wording of that error) from everything else, which gets printed instead of silently swallowed. A blanket catch here is exactly the failure mode that caused the original outage: the migration failed on Postgres, nobody saw it, and the app kept 500ing on every request that touched the new column. If you're touching that function, preserve this distinction rather than reverting to a blanket catch.

5. **If the column needs a non-trivial backfill** (not just a static default), that's a different, riskier shape than this list supports — stop and think through it explicitly rather than jamming a data-migrating `UPDATE` into `_LIGHT_MIGRATIONS`, since these statements run unconditionally on every single startup, forever.

6. **Update `docs/DATA_MODEL.md`** with the new field so it stays a complete reference.

7. **Sanity-check against Postgres syntax, not just SQLite,** since local dev never actually exercises the Postgres path. If unsure whether a construct is ANSI-safe, prefer the more conservative/widely-supported form. `tests/test_migrations.py::test_light_migrations_never_use_sqlite_only_boolean_syntax` guards the specific boolean case — extend it if you're introducing a new class of SQLite-lenient syntax risk.

8. **Run `pytest tests/test_migrations.py`** — it recreates a stale-shaped table and asserts `run_light_migrations()` brings it up to date idempotently (safe to run twice in a row).
