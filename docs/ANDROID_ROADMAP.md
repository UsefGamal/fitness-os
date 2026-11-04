# Android app roadmap

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

## Phase 2: a JSON API beside the pages

- `api/v1/` routers for body, workouts and sets, meals, hydration, quests, settings and the plan content, reusing `models.py` and `validation.py`.
- Bearer-token login for the app: a long-lived token created from Settings, revocable.
- `GET /api/v1/state` and `PUT /api/v1/state` with a revision number; a stale revision gets a 409 with the current state.
- CORS for the app's origin only. Tests for every endpoint.

**Done when** every page's data can be read and written as JSON, with tests passing in CI.

## Phase 3: offline-first app inside the APK (the big one)

- `mobile/`: React + Vite + react-router + Zustand, Capacitor Android project in `mobile/android/`. `android-shell/` is removed.
- Screens: Today, Plan (RECOMP week), Workout (sets + rest timer), Meals, Shopping list, Body, Progress, Settings.
- Plan content comes from `scripts/export-content.py` (JSON from `content/`).
- Decision logic as pure helpers with tests in `mobile/src/lib/`.
- State in `localStorage` plus a JSON file mirror in app storage; sync with `api/v1/state` when online, merging field by field on a 409.
- Native local notifications: 6:30 AM and 7:30 PM workout reminders, meal-time reminders.
- JSON export and import through the share sheet.
- The Jinja pages stay as the desktop and fallback view.

**Done when** the app works fully in airplane mode and catches up once back online.

## Phase 4: phone extras

- Rest timer in the notification shade (foreground service).
- Health Connect: read weigh-ins, write finished workouts.
- Home-screen widget: today's workout and the next meal.
- Modules: hide areas you don't use (padel, simulator).

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
