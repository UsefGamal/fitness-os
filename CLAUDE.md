# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Setup
python -m venv .venv
.venv/Scripts/activate          # source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env            # fill in real values

# Run the dev server
uvicorn main:app --host 127.0.0.1 --port 8000

# Tests
pip install -r requirements-dev.txt
pytest                          # whole suite
pytest tests/test_body.py       # one file
pytest tests/test_body.py::test_add_body_log_creates_entry   # one test

# Lint + type check (same checks CI runs)
ruff check .                    # add --fix to auto-apply safe fixes
mypy .
```

Local DB defaults to `sqlite:///./fitness.db` (gitignored, auto-created on startup — delete it any time for a clean slate; `main.py`'s lifespan reseeds `Profile` and the `Exercise` library).

`tests/conftest.py` sets `DATABASE_URL`/`APP_PASSWORD`/`SESSION_SECRET`/`CRON_SECRET` to test-only values *before* importing the app, so the suite always runs against its own temp SQLite file. An autouse fixture drops all tables before/after every test, so tests never see each other's data.

## Architecture

**One user, no build step.** FastAPI + SQLModel + server-rendered Jinja2, plain CSS, one small vanilla JS file for optimistic UI. Python 3.12 is pinned — 3.14 breaks sqlmodel/pydantic.

**Router-per-feature-area**, all registered in `main.py`: `routers/{body,gym,home,recovery,cardio,padel,meals,bonus,settings,simulate,reminders,training,webhooks}.py`. Each router owns its own GET (page) + POST (create/edit) + POST `/delete` handlers for one entity type, following the same shape as `routers/body.py`: fetch logs → build any chart SVGs via `charting.py` → render a template. `routers/training.py` is just the `/training` hub page, not a distinct workout type.

**Request flow for a logged entry** (e.g. `POST /body`): FastAPI/Pydantic's `Form(...)` params handle required-ness and type coercion → domain-range checks in `validation.py` (`require_range`/`require_choice`/`require_max_length`/`require_not_future`, each raising `ValidationError`) → upsert-by-date pattern (look up an existing row for that date/session before deciding insert vs. update) → `session.commit()` → redirect with `?saved=1`. Both `ValidationError` and Pydantic's `RequestValidationError` are caught by handlers in `main.py` that redirect back to the referring page (via `_referer_path`, which strips the Referer header down to same-origin path+query — never redirect to a raw header value) with a `?error=` message, instead of a bare 422/500.

**Migrations are hand-written, not Alembic.** `SQLModel.metadata.create_all()` (in `database.py`'s `init_db()`) only creates *new tables*, never new columns on existing ones. New columns go in `database.py`'s `_LIGHT_MIGRATIONS` list as raw `ALTER TABLE ... ADD COLUMN` strings, run idempotently on every startup (each wrapped in try/except — "column already exists" is expected steady-state). **Write these as standard ANSI SQL, not SQLite-lenient syntax** — e.g. `BOOLEAN DEFAULT false`, not `DEFAULT 0`. SQLite silently accepts the latter but Postgres rejects it; this exact mistake caused a production outage (see git history around "Postgres-incompatible boolean migration"). Local dev runs SQLite, prod runs Postgres (Neon) — a migration that only gets exercised against SQLite can look fine locally and still break prod.

**Auth is deliberately minimal**: single hardcoded `APP_PASSWORD` (`auth.py`), session cookie via `SessionMiddleware`, `require_login` FastAPI dependency gates every page route. The login rate limiter (`is_login_locked_out`/`record_failed_login`) is intentionally global in-memory state, not per-IP or per-session — see the docstring in `auth.py` for why (this only stays correct as long as the app runs as a single uvicorn worker, per `render.yaml`). Password and cron-secret comparisons use `secrets.compare_digest`.

**Security headers are centralized** in `main.py`'s `response_hardening` middleware, not per-route: CSP (`script-src 'self'` — no inline `<script>` or `onclick=`/`onsubmit=` anywhere in templates; destructive actions use the `.confirm-delete` class handled in `static/app.js` instead), `Cache-Control: no-store` on every non-static response (personal health data shouldn't be cached), plus standard hardening headers. Any new route or template must stay within these constraints rather than opting out.

**The look and usability follow openGym.** Yusuf's standing rule: the theme and frontend match [openGym](https://github.com/DuarteSantos8/openGym), and where the two apps' usability differs, openGym's wins. Black page, neutral grey cards, green accent, one system font, fills and hairlines instead of outlined boxes, 44px touch targets, 16px+ inputs, floating blurred bars. The tokens live in `static/style.css`'s `:root`, the rules in `.claude/skills/frontend-design/SKILL.md`. No web fonts (the CSP allows none).

**Charts are server-rendered inline SVG/HTML** (`charting.py`: `build_line_svg`, `build_diverging_bar_svg`, `build_heatmap_html`, `build_meter_html`, `status_chip_html`) — no JS charting library. Chart fills must use the `--chart-*` CSS custom properties in `static/style.css`, not the raw UI accent colors (`--accent`/`--gold`/`--purple` are tuned to pop as buttons and fail a categorical lightness-band check as data marks — darker steps of the same hues are the chart-safe versions). Never use green-vs-red as a diverging pair; "ahead/behind target" is a status chip (icon + label + color), not color alone.

**Shared computation lives in a few hub modules**, not duplicated per router:
- `baseline.py`'s `get_baseline()` — the shared weight/pace/predicted-date baseline used by both the dashboard and `/simulate`.
- `training_counter.py` — gym/home rotation position and deload-timing helpers.
- `content/projections.py` — streaks, confidence score, adherence percentages, week-start math.
- `macro_targets.py`'s `get_macro_targets()` — Mifflin-St Jeor BMR (`content/tdee.py`) × activity multiplier → TDEE, then a deficit derived from the pace already needed to hit the profile's goal date (`baseline.target_rate_kg_per_week`, capped to a 1200 kcal floor / 1000 kcal max deficit). Falls back to the static `content.meal_plan.MACRO_TARGETS` band if there isn't enough profile data yet.

**`content/` holds static domain data as plain Python** (meal plan, food macros, gym/home/cardio/recovery programs, milestones, bonus tasks, eating-out guide, email HTML) — not database rows. `routers/meals.py`'s `PLAN_START_DATE` anchors which day of the rotation is "today" for both the meal plan and the gym/home program.

**Meal plan sync has a priority chain**: Edamam (`edamam_sync.py`/`edamam_client.py`, primary) → FitChef (`fitchef_sync.py`, secondary, kept only because it's already wired up — its free tier only ever returns sandbox data) → the static `content/meal_plan.py` plan. `get_active_day()`/`get_active_shopping_products()` walk this chain. Edamam syncs run as a FastAPI background task (`EdamamPlanSync.status`: pending → complete/error) because Edamam's real rate limit is tighter than documented and a full sync can take minutes; `edamam_sync.is_pending_stale()` guards against a stuck 'pending' row from a server restart mid-sync.

**Docs worth reading before a large change**: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) (every table/field/relationship) and [`docs/ROUTES.md`](docs/ROUTES.md) (every route by feature area).

## Code quality tooling

`ruff` (lint) and `mypy` (type check) run in CI (`.github/workflows/ci.yml`) alongside `pytest`, config in `pyproject.toml`. Two deliberate carve-outs, both commented in `pyproject.toml`:
- `B008` (function call in a default argument) is ignored — `param: X = Depends(...)` in a route signature is FastAPI's own idiomatic pattern, not the mutable-default bug that rule targets.
- mypy has `union-attr`/`attr-defined`/`index`/`call-overload`/`arg-type` disabled — SQLModel types `Field()` columns as their plain Python type for editor ergonomics, so mypy can't tell `Model.field` used in `.order_by()`/`.join()`/`.in_()` is a query construct and flags real, working query code. This is a known SQLModel/mypy limitation (SQLModel's own docs point to Pyright instead), not a license to ignore mypy elsewhere — new non-SQLModel type errors (missing annotations, wrong-type defaults, etc.) are real and should get fixed, not suppressed.

## Data-safety conventions

These are the standing rules this codebase leans on when touching the database or the external meal-plan sync jobs — apply them without being asked, the way the existing code already does:

- **Migrations are additive and ANSI-safe** (see Architecture above) — never a syntax SQLite accepts but Postgres doesn't, since local dev is SQLite and prod is Postgres.
- **A caught exception in a migration or sync path must stay visible if it isn't the expected case.** `database.py`'s `run_light_migrations()` only swallows "duplicate column"/"already exists" (the expected steady-state on every restart after the first); anything else prints instead of silently passing — a blanket `except Exception: pass` here is exactly what let a Postgres-incompatible migration reach production unnoticed once. Follow the same shape for new migration or sync code: name the specific expected failure, don't blanket-catch.
- **Background sync jobs (`edamam_sync.py`, `fitchef_sync.py`) must never raise out of their background-task entry point** — always land in a `complete`/`error` status row instead, and guard against orphaned in-flight state (see `is_pending_stale()`) since a background task has no durability guarantee across a restart/redeploy.
- **A sync trigger route must not let a second sync start while one is already in flight** — check `latest_sync(session).status` before calling `start_sync()` (see both `trigger_fitchef_sync` and `trigger_edamam_sync` in `routers/meals.py`), since a duplicate in-flight sync orphans identifiers/wastes API quota.
- **Validate at the boundary, not throughout.** Type/required-ness is FastAPI/Pydantic's job (`Form(...)`); domain-range sanity is `validation.py`'s job, called once per field at the top of a POST handler. Don't re-validate the same field deeper in the call stack.
