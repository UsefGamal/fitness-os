# CLAUDE.md

Tafra (repo and app ids still say fitness-os) is an offline Android app: training plan, guided workouts, macro targets, meal plan, shopping list. Capacitor + React + Zustand, data only on the phone, no server, no accounts, no telemetry. One app version for everyone. Scope: [`PRODUCT.md`](PRODUCT.md). Domain rules for Claude: `.claude/skills/` (training, nutrition, UX, feature fit, users). **Every change works on a 360-412px phone screen first.**

## Layout

```
content/          plan content in Python, the single source of truth
scripts/          export_content.py (content/ -> mobile/src/content.json), photos, APK build/sign, ci_changes.py
tests/            pytest for content/ and scripts
mobile/src/views/       one screen per file
mobile/src/components/  shared UI (sheets, timers, charts, Intro)
mobile/src/store/       Zustand store, persisted to localStorage + file mirror (mirror.js)
mobile/src/lib/         pure helpers, each with a *.test.js beside it
mobile/src/i18n/en.js   every visible string goes through t()
mobile/src/styles.css   tokens in :root and :root[data-theme="light"]
mobile/e2e/             harness, device tests, journeys (Playwright)
mobile/android/         native timer, widget, Health Connect, notifications
```

`content/tdee.py` and `content/projections.py` are frozen reference copies; `mobile/src/lib/` is authoritative.

## Checks (run in `mobile/`)

```bash
npm ci
npm run check          # eslint + i18n lint + tsc + unit tests (store tests too)
npm run coverage       # fails below coverage-baseline.json
node --test src/lib/foo.test.js   # one file, after npm run content
npm run e2e            # screen harness: every route at 360/390/412, LTR + RTL, with a phone's status bar (32px) and nav bar (48px); axe, <44px taps, sideways scroll, text under the bars, controls over an outline
node e2e/harness.mjs --shots      # also save screenshots to e2e/out/
node e2e/harness.mjs --update     # re-record e2e/baseline.json (counts may only go down)
npm run e2e:device     # setup, speed, midnight, file mirror (VITE_FAKE_FS build)
npm run e2e:journeys   # tapped-through flows at 360px, Cairo time
```

Python: `pip install -r requirements-dev.txt && pytest && ruff check .` (repo root). Playwright and Chromium are preinstalled in cloud sessions; don't reinstall. For a screenshot, use `vite preview` + a Playwright script in `mobile/e2e/` and hide `.fanfare` / `.popup-dim`.

## Version rule

- Each PR that changes the app (`mobile/`, `content/`) bumps `mobile/package.json` `version` (patch) **and** adds a matching entry at the top of `mobile/src/lib/whatsNewNotes.js` (1-6 short lines a friend would understand). `whatsNew.test.js` and the release build fail without it.
- When main moves while your PR is open, merge main in and rebump above main's version. Several open PRs means whichever merges second rebumps.
- `e2e/harness.mjs` `STATES` is a shared list several PRs touch: after each merge, merge main into the others and keep every entry.
- Releases: the repo owner (`UsefGamal`) tags `vX.Y.Z` on main and approves the `release` environment in Actions. Claude can't create releases.

## CI

`ci.yml` jobs: `changes` (path filter, scripts/ci_changes.py) -> `js` (coverage in UTC + Africa/Cairo; i18n, ESLint, tsc and audit once), `screens` (harness, 8 workers via `E2E_WORKERS`), `device` (device + journeys), `python`. Shared setup lives in `.github/actions/` (`node-setup` for CI, `apk-setup` for the debug and release APK builds). PR runs cancel older runs; a full run is ~2 min. `android.yml` builds a debug APK per PR; a `v*` tag builds the signed release APK and Play bundle. The release keystore is never committed.

## Code rules

- Decision logic is a pure helper in `src/lib/` with a test. Plan content stays in `content/`, never hand-copied into `mobile/`.
- Colours are tokens in both theme blocks, never literals: buttons/ticks `--accent-fill`, green text `--accent`, bars/rings/lines `--accent-stroke`, food `--guava`, recovery/water/sleep `--nile`, red only for errors. Font sizes use `--fs-*`.
- Inputs 16px+, touch targets 44px+, respect `env(safe-area-inset-*)`, works RTL.
- Units are kg only. Week start is a setting (Sunday default). Watch/Health Connect data is optional: every screen works without it.
- Dependencies: React, react-router, Zustand, Capacitor official plugins. Anything else needs a reason in the PR.
- The phone holds the user's only copy: never ship a change that can drop data; a data format change needs a version bump and an upgrade path.
- openGym (AGPL) is a reference for ideas only: don't copy its code or its Gym visual media.

## Before a PR is offered for merge

Bugs have reached the phone that a look at the right screen would have caught (v1.1.50 crashed at every rest; v1.1.51 had text under the clock and buttons over the set outline). So, for every app PR:

1. `npm run check`, `npm run e2e` and `pytest` pass in the session, not only in CI. `node e2e/harness.mjs --update` only when counts went down.
2. Every screen, sheet or state the PR touches has a harness `STATES` entry, so the bars / ring / taps / axe checks cover it. A new sheet or overlay gets one in the same PR.
3. Look at it: screenshots at 360 and 412 px with the phone bars in place (the `tafra-phone-screenshots` skill, `--sat: 32px; --sab: 48px`), dark and light, scrolled, plus the open sheet or timer. Check them yourself for clipping, overlap and cut text, then attach them to the PR.
4. Native code (`mobile/android/`): notification and widget layouts pass `tests/test_remote_views.py`. CI can't run native code on a phone, so say plainly in the PR what was not run on a phone.
5. Review panel: before saying a PR is ready, run specialist reviewer subagents on the diff and the screenshots (phone UI, Android native when `mobile/android/` changed, data safety when the store or a data format changed, and the domain skill the feature touches), let each read the others' findings, then fix what they find or list it in the PR.
6. The PR body ends with a **Phone check**: the few taps to do on the phone, naming the screen and what should show.

## PRs

- Branch `claude/<topic>`; pushes to `dependabot/*` are refused, so fixes go in a `claude/*` PR.
- No "Generated with Claude Code" line and no session link in the PR body.
- Assign `UsefGamal` and request their review.
- Stacked PRs: retarget the base to main before merging.
