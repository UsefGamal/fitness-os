# Android app roadmap

Fitness OS becomes a sideloaded Android app in phases.

> **2026-11-04 change of plan:** Render hosting is being stopped, so the app is standalone. It runs entirely inside the APK with data on the phone. Phase 2 is dropped, phase 1's `android-shell/` is replaced by `mobile/`, and phase 3 has no sync. Logs move over through the old site's Settings > "Download my data" file, which the app imports.

Fitness OS becomes a sideloaded Android app in five phases. Each phase ends with something usable on the phone. The gap analysis behind this plan (fitness-os vs openGym) is in the planning doc shared in the project; the short version of each gap is in the table at the end.

## Phase 0: fix today's app for the RECOMP week (days)

- Weekday schedule beside the existing 4-session rotation: a Sunday-start RECOMP week, a 7 AM slot and an optional 8 PM slot per day, chosen in Settings. The rotation stays available.
- Meal windows follow the training times: a small pre-workout snack around 6:15, breakfast after the 7 AM session, a protein-heavy meal after the 8 PM session.
- Each RECOMP day links to that day's meal plan, and the meal page links back.
- Progress tracker: one-tap check-off for today's workout and meals on the dashboard.
- Rest timer and session timer in `static/app.js` (no inline JS; CSP stays as is).
- Phone CSS: inputs at 16px, safe-area padding, 44px touch targets.

**Done when** a Sunday shows the right RECOMP workout at 7 AM with the matching meals, and nothing zooms on focus on a phone.

## Phase 1: an APK that wraps the live site (about a week)

- `android-shell/`: a Capacitor project with `server.url` set to the Render URL.
- App icon and splash from `static/icons/`; app id e.g. `com.usefgamal.fitnessos`.
- One release keystore, kept outside the repo and backed up. `scripts/build-apk.sh` builds, aligns and signs.
- A GitHub Actions job that builds a debug APK as a downloadable artifact.
- Render's free plan sleeps; expect a slow first open until phase 3, or use a paid instance.

**Done when** the APK installs on the phone and opens the dashboard.

## Phase 2: a JSON API beside the pages (dropped 2026-11-04: no server)

- `api/v1/` routers for body, workouts and sets, meals, hydration, quests, settings and the plan content, reusing `models.py` and `validation.py`.
- Bearer-token login for the app: a long-lived token created from Settings, revocable.
- `GET /api/v1/state` and `PUT /api/v1/state` with a revision number; a stale revision gets a 409 with the current state.
- CORS for the app's origin only. Tests for every endpoint.

**Done when** every page's data can be read and written as JSON, with tests passing in CI.

## Phase 3: the standalone app inside the APK

- `mobile/`: React + Vite + react-router + Zustand, Capacitor Android project in `mobile/android/`. `android-shell/` is removed.
- Screens, following openGym's tab bar: Home, Plan (trainer's week), Start (guided workout with prefilled sets, rest timer and PRs), Meals, Stats (weight, history with edit, records) and Settings.
- Plan content comes from `scripts/export_content.py` (JSON from `content/`), generated on every build.
- Decision logic as pure helpers with `node --test` tests in `mobile/src/lib/`.
- State in `localStorage` plus a JSON file mirror in app storage. No server and no sync.
- Local notifications: 30 min before the 07:00 session on training days, meal times, and the end of each rest timer.
- Import of the old site's data export, and backup export to Documents.
- Shopping list (seven days from today, both options of every meal, ticks reset each Sunday), home/recovery/cardio/padel sessions, quests (daily habits, weekly quests, milestones, badges), and a profile that drives the macro targets (same Mifflin-St Jeor math as `content/tdee.py`).
- Exercise photos and instructions from free-exercise-db (public domain, 876 exercises), fetched at build time by `scripts/fetch_exercise_photos.py` at a pinned commit and bundled in the APK. `content/exercise_photos.py` maps the plan's exercises to their closest entry. openGym's own media is Gym visual-licensed and is never used.

**Done when** the app works fully in airplane mode with your imported history.

## Phase 4: phone extras

- Rest timer in the notification shade: `timer/RestTimerService.java`, a short-lived foreground service whose notification counts down on its own (Android's chronometer), with +15s and Stop buttons, and a buzzing "Rest done" alert. `RestTimerPlugin` keeps it and the in-app timer in step.
- Health Connect (`health/HealthPlugin.kt`): read weigh-ins (added only for dates the app has none for) and write finished workouts as exercise sessions, keyed by workout id so a resend updates instead of duplicating. Off until switched on in Settings; `HealthPrivacyActivity` is the rationale screen Android requires. minSdk goes to 26 for the client library.
- Home-screen widget (`widget/TodayWidget.java`): today's session or the next one, the focus, streak and meals. The app writes a week of lines (`lib/widget.js`), so it stays right after midnight.
- Modules: done in phase 3 (Meals, Water, Weight).

**Done when** a workout can be run without opening the app between sets.

## Gaps vs openGym, by phase

| Area | openGym | fitness-os today | Phase |
|---|---|---|---|
| Weekday schedule | Routine per weekday, Mon or Sun start | 4-session rotation only | 0 |
| Meal timing | n/a | Breakfast 7:00-9:30 clashes with a 7 AM session | 0 |
| Timers, check-offs | Rest timer, sets ticked off live | None / logging forms | 0 |
| Phone CSS | Touch-first | 15px inputs zoom on iOS | 0 |
| Android APK | Capacitor, signed sideload APK | PWA only | 1 |
| JSON API | Documented in `openapi.yaml` | HTML forms only | 2 |
| Phone login | Pairing code + bearer token | Password + cookie | 2 |
| Offline data + sync | Local store, file mirror, 409 merge | Server only | 3 |
| Native reminders | Local notifications | Web Push via cron | 3 |
| Backups | JSON export, auto-backup folder | Server DB only | 3 |
| Rest timer in shade, Health Connect, widget, modules | Yes | None | 4 |
| Nutrition | None | Meal plan, macros, shopping list, Edamam | fitness-os is ahead |
