# Fitness OS

A fitness and nutrition app for Android phones. It plans the week's training, guides each workout, sets calorie and macro targets, and lays out a high-protein meal plan with a weekly shopping list. Everything runs inside the APK and the data stays on the phone: no server, no account, no internet needed.

- **The app** lives in [`mobile/`](mobile/) (React + Vite + Zustand, packaged with Capacitor). Its [README](mobile/README.md) covers the screens, moving data in, and getting the APK.
- **Plan content** (meal plan, foods, programs, the weekly plan) is plain Python in [`content/`](content/). [`scripts/export_content.py`](scripts/export_content.py) turns it into the JSON the app bundles.
- **Scope** for version 1 is in [PRODUCT.md](PRODUCT.md).
- **How to work on it** is in [CLAUDE.md](CLAUDE.md).

## The old web app

Fitness OS started as a FastAPI site hosted on Render. That site was retired in November 2026 when the app went standalone. Its last version is kept on the [`web-final`](https://github.com/UsefGamal/fitness-os/tree/web-final) branch. Data from it moves into the app through the old site's Settings > "Download my data" file, which the app imports.

## Quick start

```bash
cd mobile
npm ci
npm test           # exports content/, then runs the lib tests
npm run coverage   # the same tests with the coverage gate CI uses
npm run dev        # the app in a browser at phone size
```

`scripts/build-apk.sh` builds an APK (needs JDK 21 and the Android SDK). CI builds one on every PR; signed releases come from tags (see `mobile/README.md`).

The Python side only exports content:

```bash
pip install -r requirements-dev.txt
pytest
ruff check .
```
