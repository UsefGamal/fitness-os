# Route map

Every route in the app, grouped by feature area. All routes except `/login`, `/healthz`, `/healthz-warm`, and `/cron/*` require a logged-in session (`require_login` dependency or an explicit `is_logged_in()` check → redirect to `/login`).

## Auth & shell

| Method | Path | Renders / Returns | Purpose |
|---|---|---|---|
| GET | `/login` | `login.html` | Login form |
| POST | `/login` | redirect `/` or `login.html` (401) | Password check against `APP_PASSWORD` |
| GET | `/logout` | redirect `/login` | Clears session |
| GET | `/` | `dashboard.html` | Home — Today's Checklist, KPI row, goal progress, confidence, streak heatmap, this week's plan |
| GET | `/more` | `more.html` | Secondary nav — links to everything not on the bottom tab bar. Reached via the header icon (top right), not the tab bar |
| GET | `/help` | `help.html` | User-facing reference — see [README](../README.md) |
| GET | `/healthz` | `{"status":"ok"}` | Render health check |

## Training

| Method | Path | Renders / Returns | Purpose |
|---|---|---|---|
| GET | `/training` | `training.html` | Hub page (bottom tab bar) — "next up" preview + deload banner, then links to Gym, Home, Recovery, Cardio, Padel, Gym Progress |

## Body

Reached via More, not the bottom tab bar — a weekly/biweekly activity, not a daily one.

| Method | Path | Renders / Returns | Purpose |
|---|---|---|---|
| GET | `/body` | `body.html` | Weight trend chart, weekly weight-change bar chart, log/edit form, full history table. `?edit=<id>` prefills the form from that entry |
| POST | `/body` | redirect `/body` | Upsert a `BodyLog` row (by `log_date` — editing via the prefilled form just resubmits the same date) |
| POST | `/body/{log_id}/delete` | redirect `/body` | Delete a `BodyLog` row |

## Meals

| Method | Path | Renders / Returns | Purpose |
|---|---|---|---|
| GET | `/meals` | `meals.html` | The day's plan (`?view_date=` to browse other days) — 2 options per slot, drinks, hydration meter, macro meters, 14-day macro trend sparklines, 28-day adherence heatmap, eating-out tips |
| POST | `/meals/toggle` | redirect `/meals?view_date=` | Mark a meal option eaten (re-clicking the same option un-marks it; clicking the other one switches) |
| POST | `/meals/drink` | redirect `/meals?view_date=` | Set/clear the drink for a slot — independent of completion |
| POST | `/meals/hydration` | redirect `/meals?view_date=` | Add ml to today's `HydrationLog` |
| GET | `/meals/maintenance` | `maintenance.html` | Post-cut reverse-diet guidance (static content) |
| GET | `/meals/shopping-list` | `shopping_list.html` | Aggregated ingredient list for the next 7 days (both options), grouped into color-coded grocery categories |
| POST | `/meals/edamam-sync` | redirect `/more?synced=1` | Kick off a real 14-day plan sync from Edamam (primary source) — creates a `pending` `EdamamPlanSync` row, real work runs as a background task; see [sync-job-pattern](../.claude/skills/sync-job-pattern/SKILL.md) |
| POST | `/meals/fitchef-sync` | redirect `/more?synced=1` | Kick off a FitChef sync (secondary, sandbox-limited) — async job/polling model, advanced on the next `/more` or `/meals` page load |

## Gym

| Method | Path | Renders / Returns | Purpose |
|---|---|---|---|
| GET | `/gym` | `gym_list.html` | Next program day preview, start-session form, past sessions (with delete), deload banner |
| GET | `/gym/progress` | `gym_progress.html` | Per-exercise strength sparklines, session volume chart, RPE trend — **registered before `/gym/{workout_id}` to avoid path shadowing** |
| POST | `/gym/new` | redirect `/gym/{id}` | Create a `Workout(workout_type="gym")`, auto-labels `notes` with the next program day if blank |
| GET | `/gym/{workout_id}` | `gym_detail.html` | Body map, warm-up/cool-down, program checklist with weight suggestions + alternatives + video links, set-logging form, session notes form, per-set delete, whole-session delete |
| POST | `/gym/{workout_id}/sets` | redirect `/gym/{id}` | Log a `WorkoutSet` (reps/weight/RPE) |
| POST | `/gym/{workout_id}/sets/{set_id}/delete` | redirect `/gym/{id}` | Delete a single `WorkoutSet` |
| POST | `/gym/{workout_id}/notes` | redirect `/gym/{id}` | Set session RPE + pain note |
| POST | `/gym/{workout_id}/delete` | redirect `/gym` | Delete the session and its `WorkoutSet` rows |

## Home (bodyweight)

| Method | Path | Renders / Returns | Purpose |
|---|---|---|---|
| GET | `/home` | `home_list.html` | Same pattern as Gym, bodyweight version, past sessions with delete |
| POST | `/home/new` | redirect `/home/{id}` | Create a `Workout(workout_type="home")` — shares the gym rotation counter |
| GET | `/home/{workout_id}` | `home_detail.html` | Body map, checklist with reps-based progression, alternatives, video links |
| POST | `/home/{workout_id}/notes` | redirect `/home/{id}` | Session RPE + pain note |
| POST | `/home/{workout_id}/log` | redirect `/home/{id}` | Mark a checklist item done + optional reps achieved |
| POST | `/home/{workout_id}/delete` | redirect `/home` | Delete the session and its `ChecklistItemLog` rows |

## Recovery

| Method | Path | Renders / Returns | Purpose |
|---|---|---|---|
| GET | `/recovery` | `recovery_list.html` | Start-session form, past sessions with delete |
| POST | `/recovery/new` | redirect `/recovery/{id}` | Create a `Workout(workout_type="recovery")` — doesn't advance the gym/home rotation |
| GET | `/recovery/{workout_id}` | `recovery_detail.html` | Simple checklist (walk/stretch/mobility/etc.) |
| POST | `/recovery/{workout_id}/notes` | redirect `/recovery/{id}` | Session RPE + pain note |
| POST | `/recovery/{workout_id}/log` | redirect `/recovery/{id}` | Mark a checklist item done |
| POST | `/recovery/{workout_id}/delete` | redirect `/recovery` | Delete the session and its `ChecklistItemLog` rows |

## Cardio

| Method | Path | Renders / Returns | Purpose |
|---|---|---|---|
| GET | `/cardio` | `cardio.html` | Target session spec (incline treadmill walk), log/edit form, duration trend, history with edit/delete. `?edit=<id>` prefills the form |
| POST | `/cardio` | redirect `/cardio` | Log a `Workout(workout_type="cardio")` in one step (duration, RPE, notes); an included `workout_id` updates that row in place instead of inserting |
| POST | `/cardio/{workout_id}/delete` | redirect `/cardio` | Delete a cardio session |

## Padel

| Method | Path | Renders / Returns | Purpose |
|---|---|---|---|
| GET | `/padel` | `padel.html` | W-L-D record, pain-pattern flag, duration trend, log/edit form, history with edit/delete. `?edit=<id>` prefills the form |
| POST | `/padel` | redirect `/padel` | Log a `Workout(workout_type="padel")` in one step (duration, RPE, result, notes, pain note); an included `workout_id` updates that row in place instead of inserting |
| POST | `/padel/{workout_id}/delete` | redirect `/padel` | Delete a padel session |

## Quests / gamification

| Method | Path | Renders / Returns | Purpose |
|---|---|---|---|
| GET | `/bonus` | `bonus.html` | Points total, badge progress, today's quest checklist |
| POST | `/bonus/toggle` | redirect `/bonus` | Toggle a `BonusLog` row for today (adds/removes its points) |

## Settings & tools

| Method | Path | Renders / Returns | Purpose |
|---|---|---|---|
| GET | `/settings` | `settings.html` | Edit `Profile` (height, DOB, goal weight/date, starting weight, fitness level, notes) |
| POST | `/settings` | redirect `/settings?saved=1` | Save `Profile` |
| GET | `/simulate` | `simulate.html` | What-if scenario inputs → projected goal date vs. baseline (reuses `baseline.py`, doesn't touch the DB) |

## Cron / automation

Secret-protected via `?secret=<CRON_SECRET>` or an `X-Cron-Secret` header (403 without either). See the README's [Scheduled jobs](../README.md#scheduled-jobs) for the actual schedule setup.

| Method | Path | Renders / Returns | Purpose |
|---|---|---|---|
| GET | `/healthz-warm` | `{"status":"ok"}` | No-DB keep-alive ping, no secret required |
| GET | `/cron/daily-digest` | `{"status": "queued"\|"skipped"}` | Queues the daily digest email as a background task and responds immediately — cron-job.org's free tier times out at 30s, and building the digest + calling Resend inline used to risk that, especially on a cold Render instance. `&force=true` bypasses the already-sent-today skip. Actual outcome (`sent`/`error` + detail) lands in a `ReminderLog` row, surfaced on `/more` |
| GET | `/cron/weekly-recap` | `{"status": "queued"\|"skipped"}` | Same pattern as `/cron/daily-digest` |

## Webhooks

| Method | Path | Renders / Returns | Purpose |
|---|---|---|---|
| POST | `/webhooks/fitchef` | `{"status": "acknowledged"}` | FitChef's callback for async mealplan generation — acknowledged only, no signature verification available; the real completion check is `fitchef_sync.advance_sync()`'s polling |

## Template includes (not routes)

`templates/base.html` (page shell + tab bar), `templates/_icons.html` (SVG sprite, included once in `base.html`), `templates/_body_map.html` (included from `gym_detail.html` / `home_detail.html`).
