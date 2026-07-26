# Fitness OS

A self-hosted, single-user fitness and nutrition tracker built for a 6-month body-recomposition program (103kg → 75-80kg, Aug 2026 – Jan 2027). Structured-portion Egyptian/Syrian/grilled meal plan, an intermediate 4-day Upper/Lower gym program with bodyweight/cardio/recovery alternatives, body and padel tracking, a full gamification layer, validated data-viz charts, and daily/weekly email digests — all server-rendered, no JS framework, no build step.

## Overview

- **Who it's for**: one user, password-gated, no multi-tenancy.
- **Program window**: `PLAN_START_DATE = 2026-08-01` (in `routers/meals.py`) — the meal/gym rotations anchor to this date.
- **Philosophy**: structured portions, not calorie-counting. Two selectable options per meal (Egyptian- and Syrian/grilled-leaning), macro-matched to the same daily band, no fish/seafood.

## Features

**Nutrition**
- 14-day (2-week) rotating meal plan, 2 options per slot, fiber tracked alongside kcal/protein/carbs/fat
- Hour windows per meal slot, drink selection, hydration goal + quick-log meter
- Automatic refeed day every 2-week cycle (day 14, ~2400-2600 kcal)
- "Eating out?" guidance per meal + general rules
- 7-day shopping list generator, post-cut reverse-diet maintenance guide

**Training**
- 4-day Upper/Lower gym program (intermediate), mirrored bodyweight Home program, Active Recovery checklist, dedicated Cardio (excluded from the lift rotation), Padel logging
- Per-set and session-level RPE, deload flag + automatic "N weeks since your last deload" banner, pain/tweak notes, session volume
- Interactive body-map (targeted muscle groups), YouTube form-check links, same-muscle-group alternative exercises
- `/gym/progress`: per-exercise strength trend, session volume chart, RPE trend
- Padel win/loss/draw record; a pain-pattern flag surfaces on the dashboard if 3+ of the last 5 sessions (any training type) logged discomfort

**Body tracking**
- Weight, waist, chest, arm, hips, thigh, sleep hours
- Weight-vs-goal trend chart (emphasis form: actual line + dashed goal reference) plus a weekly weight-change bar chart
- Reached via More (not the bottom tab bar) since it's a weekly/biweekly check-in, not a daily one

**Editing & deleting logged data**
- Body log entries, and gym/home/recovery/cardio/padel sessions (including individual gym sets) can all be edited (cardio/padel/body via a prefilled form) or deleted — mistakes and duplicate logs don't have to stay forever

**Gamification**
- Points, levels, tiered badges (bronze → diamond), daily streak
- Quest board with three cadences — daily habits, weekly quests, one-time milestones — so it isn't just a checklist that zeroes out every midnight
- Confidence score (blended pace-vs-target + adherence) shown as a status chip, predicted goal date, a what-if simulator (`/simulate`)

**Dashboard**
- Today's Checklist (meal chips, hydration meter, quest count) so a daily check-in doesn't require hopping across tabs
- KPI row (weekly weight delta, streak, meal adherence, avg RPE), 5-week streak heatmap, adherence-vs-outcome insight

**Email automation**
- Daily digest (meal plan + gym day) and a weekly recap, both dark-themed to match the app, sent via a secret-protected cron endpoint (see [Scheduled jobs](#scheduled-jobs))

## Tech stack

- **Backend**: FastAPI + SQLModel (SQLAlchemy + Pydantic), Python 3.12 (pinned — 3.14 breaks sqlmodel/pydantic)
- **Templates**: Jinja2, server-rendered, no SPA framework
- **Styling**: plain CSS (`static/style.css`), dark theme, CSS custom properties
- **Charts**: server-rendered inline SVG/HTML (`charting.py`), no JS charting library — see [Chart color system](#chart-color-system)
- **Icons**: one self-hosted SVG sprite (`templates/_icons.html`), mono-color line icons via `currentColor`
- **JS**: one small vanilla file (`static/app.js`) for optimistic toggle animations — no framework, no bundler
- **DB**: SQLite locally, Postgres (Neon) in production
- **Email**: Resend API
- **Hosting**: Render (free web service)

## Project structure

```
main.py                  # app setup, router registration, dashboard route
models.py                 # all SQLModel tables
database.py                # engine + run_light_migrations() (see Migrations)
auth.py                    # single-user session auth
baseline.py                 # shared projection baseline (dashboard + simulator)
training_counter.py          # shared gym/home rotation counter, deload helpers
charting.py                   # line/sparkline/bar/meter/heatmap/status-chip builders

routers/                       # one file per feature area (body, gym, home, recovery,
                                # cardio, padel, meals, bonus, settings, simulate, reminders,
                                # training — the /training hub page)
content/                        # plain-Python content modules: meal plan, food macros,
                                 # gym/home/cardio/recovery programs, milestones, bonus
                                 # tasks, eating-out guide, maintenance plan, email HTML
templates/                       # Jinja2 templates, one per page + base.html + _icons.html
                                  # + _body_map.html (shared includes)
static/                           # style.css, app.js, manifest.json, icons/
```

## Local development

```bash
python -m venv .venv
.venv/Scripts/activate        # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env          # fill in real values
uvicorn main:app --host 127.0.0.1 --port 8000
```

Local DB defaults to `sqlite:///./fitness.db` (auto-created on first run, gitignored). Delete it any time for a clean slate — `main.py`'s startup event reseeds the `Profile` row and the `Exercise` library.

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

`tests/conftest.py` sets `DATABASE_URL`/`APP_PASSWORD`/`SESSION_SECRET`/`CRON_SECRET` to test-only values *before* importing the app, so the suite always runs against its own temp SQLite file — never the real dev or production database. Each test gets a freshly-migrated, empty database (an autouse fixture drops all tables before/after every test). Covers: auth + login rate-limiting, full CRUD (create/edit/delete) for every logged entity, server-side validation error paths, the shopping-list ingredient-merging logic, quest cadences, migration idempotency (including a regression guard for the SQLite/Postgres boolean-default bug), security headers/CSP/cron-secret auth, and meal-plan sync (against a monkeypatched Spoonacular client — no real API key needed to run the suite).

## Deployment

- **Render**: `render.yaml` blueprint (free web service, Python 3.12.10 pinned via `runtime.txt` + `PYTHON_VERSION`). Push to `main` → auto-deploy.
- **Database**: Neon Postgres (`DATABASE_URL`, `sslmode=require`).
- **Repo**: private, scoped to `d:\Fitness\app` only.

### Environment variables

| Variable | Purpose |
|---|---|
| `APP_PASSWORD` | single-user login password |
| `SESSION_SECRET` | cookie session signing (Render can auto-generate) |
| `DATABASE_URL` | Postgres connection string in production |
| `RESEND_API_KEY` | Resend API key for outbound email |
| `DIGEST_EMAIL_TO` | where digest/recap emails go |
| `CRON_SECRET` | shared secret for the `/cron/*` endpoints |
| `APP_BASE_URL` | used to build links inside emails |
| `SPOONACULAR_API_KEY` | optional — enables the meal-plan sync feature (see below) |

All are `sync: false` in `render.yaml` — set manually in the Render dashboard, never committed.

## Scheduled jobs

Set these up on [cron-job.org](https://cron-job.org) (or any external scheduler) — the app itself has no internal scheduler.

| Job | URL | Suggested schedule | Purpose |
|---|---|---|---|
| Daily digest | `https://fitness-os.onrender.com/cron/daily-digest?secret=<CRON_SECRET>` | Daily, e.g. 6:00 AM | Meal plan + gym day email |
| Weekly recap | `https://fitness-os.onrender.com/cron/weekly-recap?secret=<CRON_SECRET>` | Weekly, e.g. Sunday evening | Weight/adherence/points recap email |
| Keep-alive | `https://fitness-os.onrender.com/healthz-warm` | Every 10-14 min | Stops the Render free-tier instance from sleeping, so the digest cron doesn't land on a cold start |

Both digest endpoints:
- Skip silently if already sent today (dedup via `ReminderLog`) — add `&force=true` to resend on demand.
- Never throw an uncaught error — failures return a small structured JSON body (`{"status":"error","detail":"..."}`) so they're diagnosable via a plain curl instead of guessing from a cron monitor's failure report.
- Accept the secret via an `X-Cron-Secret` header instead of `?secret=` in the URL — preferred, since URL query strings end up in access logs and referrer headers. cron-job.org supports custom headers under a job's "Advanced" tab. The query param still works for backward compatibility.

## Security

- Single-user, password-gated (`APP_PASSWORD`), session cookie is `httponly` + `same_site=lax` + `secure` in production (detected via Render's `RENDER` env var).
- Login is rate-limited: 5 failed attempts locks out further attempts for 60 seconds (global, not per-IP — see `auth.py` for why).
- Password and cron-secret comparisons are constant-time (`secrets.compare_digest`).
- Every dynamic response sends `Cache-Control: no-store` (personal health data shouldn't be cacheable) plus standard hardening headers (CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`). The CSP is `script-src 'self'` — no inline `<script>` or `onclick=`/`onsubmit=` handlers anywhere in the templates; destructive actions (delete buttons) confirm via a `.confirm-delete` class handled in `static/app.js` instead.
- **If `CRON_SECRET` has ever been shared in plaintext (chat, email, etc.), rotate it** — generate a new value, update it in Render's dashboard and in the cron-job.org job URLs/headers.

## Meal plan sync

The built-in 14-day plan (`content/meal_plan.py`) is the default, but a "Sync now" button on More can replace it with a fresh one pulled from the [Spoonacular](https://spoonacular.com/food-api) recipe API — matching the same daily macro band, drawing from any cuisine (fish/seafood included), excluding alcohol and creatine/protein-powder. Requires `SPOONACULAR_API_KEY`; without it, sync fails cleanly and the app keeps using whichever plan (static or previously-synced) was already active.

- `content/spoonacular_client.py` — the only module that knows Spoonacular's request/response shape; defensive by design (a recipe with unparseable nutrition is skipped, not fatal).
- `content/meal_sync.py` — `run_sync()` queries ~20 candidate recipes per meal slot (not per day — 5 API calls, not 140) matched to that slot's share of the daily macro band, then spreads them across all 14 days × 2 options. `get_active_day()` and `get_shopping_entries_for_day()` are read through by every caller that used to read the static plan directly (meals page, dashboard week preview, shopping list, daily digest email) — each falls back to the static plan automatically if no sync has ever run.
- No sync history is kept — a new sync replaces the previous one (`MealPlanSync` + `SyncedMealOption` tables), since only the current plan matters here, unlike the user's own logged data.
- Ingredient categorization for the shopping list uses Spoonacular's own `aisle` field, mapped onto the same 6 color-coded categories the static plan's shopping list already uses.

## Data model

Key tables (`models.py`): `Profile` (single row — stats/goal), `BodyLog`, `Workout` (`workout_type` ∈ gym/home/recovery/cardio/padel; `session_rpe`/`is_deload`/`pain_note`/`result`), `Exercise`, `WorkoutSet` (`rpe`), `ChecklistItemLog` (Home/Recovery), `MealLog` (`option_key`/`drink_key`), `HydrationLog`, `BonusLog`, `ReminderLog` (email dedup).

### Migrations

`SQLModel.metadata.create_all()` only creates new tables, not new columns on existing ones. New columns go in `database.py`'s `_LIGHT_MIGRATIONS` list as idempotent raw `ALTER TABLE ... ADD COLUMN` statements (wrapped in try/except, run on every startup). **Write these as standard ANSI SQL, not SQLite-lenient syntax** — e.g. `BOOLEAN DEFAULT false`, not `DEFAULT 0` (the latter is silently accepted by SQLite but rejected by Postgres, which was the root cause of a production outage — see git history around the "Postgres-incompatible boolean migration" commit).

## Chart color system

Charts use a validated subset of the app's palette (`--chart-*` tokens in `static/style.css`), not the raw UI accent colors — the bright accents (`--accent`, `--gold`, `--purple`) fail a standard categorical lightness-band check as data marks (they're tuned to pop as buttons, not sit as chart fills). Darker steps of the same hues pass instead. Green-vs-red is never used as a diverging pair (classic red-green colorblind failure); "ahead/behind target" uses a status chip (icon + label + color) instead of color alone.

## Further documentation

- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — every table, field, and relationship
- [`docs/ROUTES.md`](docs/ROUTES.md) — every route, grouped by feature area
- In-app: `/help` (linked from More) — a user-facing "how this works" reference

## Known gaps / deliberately out of scope

- No Apple Health / Google Fit sync
- No progress-photo timeline
- No live JS chart tooltips (direct labels + the existing history tables serve as the accessibility/precision twin instead)
- No automated test suite — verification has been manual (local server + PowerShell smoke tests) plus one-off throwaway scripts for math-heavy changes
