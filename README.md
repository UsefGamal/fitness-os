# Tafra (طفرة)

_Your next leap._ A free training and meal plan app for Android. It plans the week's training, guides each workout, sets calorie and protein targets from your goal, and lays out a high-protein meal plan with a weekly shopping list. Everything runs inside the app and the data stays on the phone: no server, no account, no ads, no tracking.

The repository and the app's internal ids still say `fitness-os`; the name people see is Tafra.

## What it does

- **Train:** a weekly plan from ready-made routines, guided workouts with suggested weights and a rest timer that keeps running in the notification bar, exercise swaps, home, cardio, padel, interval and recovery sessions.
- **Eat:** calorie and macro targets from the profile and goal (lose fat, recomp, keep, or build muscle), a meal plan from one shared meal library with ticks, water, your own foods, a weekly shopping list and Ramadan mode.
- **See progress:** weight trend with a safe pace, body measurements, progress photos, strength records, muscle volume, weekly streaks and badges.
- **Stay safe and private:** a short safety check at setup, backups you can save anywhere, optional automatic backup, and optional Health Connect.

## Where things are

| Path | What it holds |
| --- | --- |
| [`mobile/`](mobile/) | The app (React + Vite + Zustand, packaged with Capacitor). Its [README](mobile/README.md) covers the screens, data, builds and releases. |
| [`content/`](content/) | Plan content in plain Python: routines, exercises, meal library, ingredients. [`scripts/export_content.py`](scripts/export_content.py) turns it into the JSON the app bundles. |
| [`scripts/`](scripts/) | Content export, photo fetchers, APK and Play bundle build and signing, CI helpers. |
| [`tests/`](tests/) | pytest for `content/` and `scripts/`. |
| [`docs/`](docs/) | [Device checks](docs/DEVICE_MATRIX.md) before a pilot build, and [Google Play](docs/play/README.md) steps. |

## Other documents

- [PRODUCT.md](PRODUCT.md): what version 1 is and isn't. Check new ideas against it first.
- [PRIVACY.md](PRIVACY.md): the privacy policy (also the Play Store privacy link).
- [CLAUDE.md](CLAUDE.md): how to work on the code: layout, checks, version rule, CI and PRs.

## Quick start

```bash
cd mobile
npm ci
npm run dev        # exports content/, then the app in a browser at phone size
npm run check      # eslint, i18n lint, tsc and unit tests
npm run e2e        # every screen at 360/390/412 px, left-to-right and right-to-left
```

`scripts/build-apk.sh` builds an APK (needs JDK 21 and the Android SDK). CI builds a debug APK on every PR; signed releases come from `vX.Y.Z` tags (see [mobile/README.md](mobile/README.md#getting-the-app)).

The Python side only holds and exports content:

```bash
pip install -r requirements-dev.txt
pytest
ruff check .
```
