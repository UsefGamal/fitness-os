# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is, and where it is going

Fitness OS is Yusuf's single-user fitness and nutrition tracker for a body-recomposition program. Today it is a server-rendered FastAPI app used as a PWA. **The goal is an Android app (a sideloaded APK) that works on the phone first**, modelled on [openGym](https://github.com/DuarteSantos8/openGym)'s mobile approach, reached in phases (see [Roadmap: the Android app](#roadmap-the-android-app) below and [`docs/ANDROID_ROADMAP.md`](docs/ANDROID_ROADMAP.md)). Every change should work on a phone screen first; desktop is secondary.

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

**Pages, features and content follow openGym too**, unless the feature doesn't exist there. openGym's shape is the target: tab bar Home / Plan / Start / Meals / Stats, a weekday Plan with starter plans and editable routines, a guided workout screen (prefilled weights, rest timer, one tap per set, PRs), Stats, History with edit, an exercise Library, grouped Settings, Modules, data export. fitness-os-only features (meals, shopping list, hydration, quests, simulator, padel, cardio, recovery, digests) stay, restyled to match. The page-by-page mapping is in `docs/ANDROID_ROADMAP.md` once merged, and in the planning doc. Content: reuse only what is MIT upstream of openGym (the ExerciseDB v1 text via `hasaneyldrm/exercises-dataset`, MuscleMap body outlines), never openGym's own AGPL text or its licensed media.

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

## Roadmap: the Android app

The plan, in order. Each phase ends with something usable on the phone, so don't start a later phase's structure early. Detail and exit checks per phase are in [`docs/ANDROID_ROADMAP.md`](docs/ANDROID_ROADMAP.md).

| Phase | What | Where it lives |
|---|---|---|
| 0 | RECOMP weekday schedule (Sunday-start week, 7 AM slot + optional 8 PM slot) beside the 4-session rotation; meal windows timed around training; per-day link from workout to that day's meal plan; one-tap check-offs; rest/session timer; phone CSS (16px inputs, safe areas, 44px targets) | existing `content/`, `routers/`, `templates/`, `static/` |
| 1 | An APK that wraps the live site (Capacitor, `server.url` = the Render URL), icon, keystore, build script, CI debug-APK job | `android-shell/`, `scripts/build-apk.sh` |
| 2 | JSON API beside the HTML pages, bearer-token login for the app, `GET/PUT /api/v1/state` with a revision | `api/v1/`, `tests/test_api_*.py` |
| 3 | Offline-first app bundled in the APK: React + Vite + react-router + Zustand, local store + file mirror, sync with merge on conflict, native local notifications (6:30 AM, 7:30 PM, meal times), JSON export/import | `mobile/` (Capacitor `android/` moves here, `android-shell/` is removed) |
| 4 | Rest timer in the notification shade, Health Connect (read weigh-ins, write workouts), home-screen widget, modules to hide unused areas | `mobile/android/app/src/main/java/...` plugins |

Things that stay in scope throughout: the RECOMP schedule, the high-protein fat-loss meal plan and macro targets, the progress tracker, workout/rest timers, and the weekly shopping list. Nutrition is this app's edge (openGym has none); don't trade it away for gym-tracker features.

### Target structure

```
fitness-os/
  main.py, models.py, database.py, ...   # FastAPI app, stays at the root
  routers/            # HTML pages, one file per feature area
  api/v1/             # phase 2: JSON routers + Pydantic request/response schemas
  content/            # plan content in plain Python: the single source of truth
  templates/, static/ # Jinja pages; remain the desktop/fallback view after phase 3
  tests/              # pytest, including api/v1
  android-shell/      # phase 1 only: remote-URL Capacitor wrapper
  mobile/             # phase 3: the phone app
    src/views/        # one screen per file (Today, Plan, Workout, Meals, Shopping, Body, Progress, Settings)
    src/components/   # shared UI (timers, check-off chips, charts)
    src/store/        # one Zustand store, persisted to localStorage + mirrored to a file on the phone
    src/lib/          # pure, framework-free helpers, each with a *.test.js beside it
    android/          # Capacitor Android project
    capacitor.config.json
  scripts/            # build-apk.sh, export-content.py (content/ -> JSON for mobile/)
  docs/               # DATA_MODEL.md, ROUTES.md, ANDROID_ROADMAP.md, later MOBILE.md
```

### Rules for the mobile work

- **Phone first.** Design every screen at 360-412px wide first. Inputs at 16px or more (smaller makes mobile browsers zoom on focus), touch targets at least 44px, respect `env(safe-area-inset-*)`.
- **One source of truth for plan content.** Meal plan, programs and the RECOMP week stay in `content/`; `mobile/` reads JSON exported by `scripts/export-content.py`, never a hand-copied duplicate.
- **Decision logic is a pure helper with a test** (in `mobile/src/lib/` with a `*.test.js`, or in Python with a pytest): what's scheduled today, macro targets, which meal day, shopping-list merging, streaks. When a rule exists in both Python and JS, keep matching test cases on both sides and change them together.
- **The API is additive.** `api/v1/` reuses `models.py`, `validation.py` and the same session dependency; it does not change the HTML routes' behaviour. Every new endpoint gets a test. Keep the CSP and `no-store` rules from `main.py` for HTML; CORS is allowed only for the app's own origin (`https://localhost` / `capacitor://localhost`).
- **Dependency-light.** Frontend: React, react-router, Zustand, Capacitor and its official plugins. Anything else needs a reason in the PR.
- **Data on the phone is the user's only copy when offline.** Every store write also lands in the file mirror; never ship a change that can drop unsynced local edits. Bearer tokens go in Android secure storage, never in synced state or backups.
- **No telemetry, no third-party SDKs.** This is personal health data.
- **Signing.** The release keystore is never committed (`*.keystore`, `*.jks` are gitignored). Losing it means the APK can't update in place; say so when touching signing.

### Using openGym as a reference

openGym is a reference for structure and approach, not a code source:

- It is **AGPL-3.0**. Reimplement ideas in our own code; don't paste its files or large chunks in, which would make this repo AGPL too.
- Its **exercise stills and animations are licensed from Gym visual** separately. Never copy, download into, or link them from this repo.
- Good places to read there: `CLAUDE.md` and `docs/ARCHITECTURE.md` (overall layout), `docs/MOBILE.md` (Capacitor flavours, file mirror, pairing, APK signing), `frontend/src/lib/mobile.js` (native bridge behind a build flag), `frontend/src/lib/sync-merge.js` (409 merge), `frontend/android/app/src/main/java/.../RestTimerService.java` (rest timer in the shade).
