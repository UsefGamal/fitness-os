# Tafra phone app

The Android app. Everything runs inside the app and the data is saved on the
phone: no server, no account, no internet needed. The visible name is
**Tafra**; the app ID (`com.usefgamal.fitnessos`), APK file names and code
still say fitness-os.

## Screens

The tab bar is **Home**, **Plan**, **Start**, **Meals** and **Stats** (with
Meals switched off, **Library** takes its place). You can swipe between tabs.
Settings, Profile and the rest open from Home's menu.

- **Setup:** five short screens (welcome, about you, goal, training, done),
  each one skippable, with a short safety check, then a one-time step to
  allow reminders.
- **Home:** today's session or the next one, the week strip (Sunday start by
  default), today's meals and water, the latest weight, and quick actions.
  On a training day the session comes first; on a rest day, the weight.
- **Plan:** the routine's week with training days and times. Tap a day for
  its warm-up and working sets (with RIR, rest, notes, muscle tags and a
  muscle map). Move a session to another day, edit a day (swap an exercise
  for a close match, change sets, reps or rest, reorder), pick another
  ready-made routine, or build your own.
- **Start:** a guided workout. The next set is ready with a suggested weight
  (double progression), a big Log set button in thumb reach, and a rest
  timer that also runs in the notification bar with the screen off. Paired
  sets alternate, a new best set shows a record, and the finish sheet asks
  how it felt. Gym mode makes the buttons bigger. Intervals, follow-along
  and home, cardio, padel, stretching and recovery sessions live here too.
- **Meals:** the day's meals from the shared meal library, scaled to your
  calorie target, with ticks, recipes, swaps for any slot, your own foods,
  water, and calories and macros against your targets. **Shopping** lists
  the coming week's food by aisle. Ramadan mode moves meals to suhoor and
  iftar.
- **Stats:** the weight trend against a safe pace and your goal, body
  measurements, progress photos (locked, kept only on the phone), strength
  records, muscle volume and recovery, a fitness test, History (edit or
  delete any workout), Library, weekly streaks and badges.
- **Library:** your exercises with photos and instructions (from the public
  domain free-exercise-db), searchable by name, muscle group or a tappable
  body map, with your best set and every time you've done it.
- **Settings:** Training, Times and reminders, Data (backups, automatic
  backup, CSV, share a copy, snapshots), Preferences (theme, week start,
  modules), Safety, Health Connect, Help, Privacy and About (version, what's
  new, signing code, bug report).
- **Phone extras:** the **Tafra** home-screen widget shows today's session,
  streak and meals. Health Connect (optional) brings in weigh-ins, steps,
  sleep and resting heart rate, and saves finished workouts. Sleep and
  resting heart rate give a recovery hint on Today (Ready, Go steady, Take
  it easy) and keep muscles "recovering" a day longer on Stats after a poor
  night. It is advice only: it never changes weights or the plan.

## Your data

Data lives in the app's storage plus a file mirror in its private folder;
the newest copy wins when the app starts. When an update changes the data
format, the app upgrades it automatically and keeps a **snapshot** of the
old data first (Settings > Snapshots keeps the newest 7, also taken
before every import or restore). A backup from a newer app version is
refused instead of guessed at.

**Uninstalling the app deletes everything**, snapshots included. Export a
backup now and then (Home reminds you after 14 days), or switch on automatic
backup to a folder you pick. Backups import the same way on any later
version of the app.

## Getting the app

There are two kinds of build, and they are separate apps on the phone.

- **Releases (the one to use).** Each release is a tag like `v0.4.1`. On
  GitHub, open Releases > Draft a new release, type the new tag and publish.
  The **Android APK** workflow builds `fitness-os-0.4.1.apk`, signs it,
  checks it and attaches it to that release, so you can download it from the
  release page on the phone. Each release installs over the last one and
  keeps your data. Its versionCode comes from the tag (v0.4.1 is 4001), so a
  later tag is always higher.
- **Debug builds.** Every PR and push to `main` builds `fitness-os-debug.apk`
  (in the run's `fitness-os-apk-<n>` artifact in the Actions tab). It is
  called **Fitness OS debug**, uses its own app ID
  (`com.usefgamal.fitnessos.debug`) and its own empty data, and installs
  *beside* the real app. It can never replace or break it.
- **One app for everyone.** Each tag builds one `fitness-os-<version>.apk`
  and a Play bundle (`tafra-play-bundle-<version>` artifact) signed with the
  same key, so a Play install and a GitHub install update over each other.
  Play steps are in [`docs/play/README.md`](../docs/play/README.md).

Releases need the repo owner: they push the `vX.Y.Z` tag and approve the
`release` environment in Actions. Before each release: set `version` in `mobile/package.json` (and
`package-lock.json`) to the tag's number and add that version's notes to
`mobile/src/lib/whatsNewNotes.js`. A test fails when the notes are older than
`package.json`, and the APK's fallback version name reads the same file, so
there is one number to change.

### Releases: one-time setup

**From a phone:** add the secret `FITNESS_OS_KEYSTORE_PASSWORD`, then run
Actions > **Make signing key** > Run workflow. Its summary gives the
`FITNESS_OS_CERT_SHA256` value and its artifact holds the keystore and the
text for `FITNESS_OS_KEYSTORE_BASE64`. It refuses to run once that secret
exists. The steps below do the same on a computer.

1. Make a keystore and keep two copies offline (a USB stick and a cloud
   drive), with its password. If it's lost, no update can ever install over
   the app again.
   `keytool -genkeypair -v -keystore fitness-os.jks -alias fitnessos -keyalg RSA -keysize 2048 -validity 10000`
2. In the repo's Settings > Secrets and variables > Actions > **Secrets**, add
   `FITNESS_OS_KEYSTORE_BASE64` (from `base64 -w0 fitness-os.jks`) and
   `FITNESS_OS_KEYSTORE_PASSWORD`. Add `FITNESS_OS_KEY_ALIAS` and
   `FITNESS_OS_KEY_PASSWORD` too if they differ from the defaults.
3. Under **Variables**, add `FITNESS_OS_CERT_SHA256`, the key's certificate
   fingerprint:
   `keytool -list -v -keystore fitness-os.jks -alias fitnessos | grep SHA256`.
   Every release is checked against it with `apksigner`, so a build signed
   with the wrong key fails in CI instead of on the phone.

If the app on the phone today was signed with a different key (for example
an old debug build), Android won't install the first release over it. Export
a backup, uninstall, install the release, and import the backup. That's
needed once; after that every release updates in place.

Never commit the keystore (`*.jks` and `*.keystore` are gitignored).

### Releases you can trust (P14-08)

Each release lists both APKs' SHA-256, the certificate's SHA-256 and an
8-character **signing code** (like `AB12-CD34`). Settings > About on the
phone reads the code from Android itself; a friend checks it matches the
release message. If an update ever says "App not installed", **don't
uninstall** (that deletes the data): send a bug report from Settings >
About, or open an issue on GitHub.

One-time GitHub settings (repo owner):

1. **Settings > Environments > New environment** `release`. Turn on
   **Required reviewers** (yourself) and limit **Deployment branches and
   tags** to the tag pattern `v*`.
2. Move the secrets `FITNESS_OS_KEYSTORE_BASE64`,
   `FITNESS_OS_KEYSTORE_PASSWORD`, `FITNESS_OS_KEY_ALIAS` and
   `FITNESS_OS_KEY_PASSWORD` into that environment, then delete the
   repository-level copies. Only the release job (tags, after your
   approval) can read them now.
3. **Settings > Rules > Rulesets > New tag ruleset** for `v*`: only you may
   create, update or delete those tags.
4. **Settings > Actions > General > Workflow permissions**: *Read
   repository contents*. The workflows also say this themselves.
5. **Google developer verification** for sideloaded apps: register the app
   ID `com.usefgamal.fitnessos` and the certificate SHA-256 in the Android
   Developer Console before the countries where friends live require it.

Every action in the workflows is pinned to a commit SHA. To update one,
replace the SHA and the version comment together.

### Backups by Android

Android's own backup may copy the app's data file to Google Drive, so a new
phone can restore it. **Progress photos are excluded**
(`res/xml/data_extraction_rules.xml`, `backup_rules.xml`): they never leave
the phone. To check on the phone: Settings > Google > Backup > App data
lists Tafra; its size should not grow when you add photos.

## Developing

```bash
cd mobile
npm ci
npm run dev        # exports content/ to src/content.json, then starts Vite
npm test           # node --test on src/lib/*.test.js
npm run check      # eslint, i18n lint, tsc and all unit tests (what CI runs)
npm run photos     # downloads and converts the exercise photos (once, ~2 min, ~50 MB)
npm run build      # dist/
../scripts/build-apk.sh   # needs JDK 21 + Android SDK
```

- Plan content comes from `content/` through `scripts/export_content.py`. Never edit `src/content.json` by hand; it's generated and gitignored.
- Decision logic lives in `src/lib/` as pure functions, each with a `*.test.js` beside it. `schedule.test.js` mirrors `tests/test_gym_program.py`, so change both together.
- Exercise photos land in `public/exercise-db/` (gitignored). `npm run build:mobile` fetches them; install Pillow (`pip install pillow`) to get WebP at half the size.
- The app's own Android plugins live in `android/app/src/main/java/com/usefgamal/fitnessos/` (`timer/`, `widget/`, `health/`, `backup/`, `crash/`, `photolock/` and more) and are registered in `MainActivity`. `src/store/native.js` is the JS side; in a browser they're no-ops.
- `src/store/useData.js` is the one Zustand store. `src/store/mirror.js` keeps the file copy and `src/store/notify.js` handles local notifications.
- The full list of checks, the version rule and PR rules are in [`CLAUDE.md`](../CLAUDE.md).
- After changing `capacitor.config.json` or a Capacitor plugin, run `npx cap sync android` and commit the result.
