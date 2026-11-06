# Fitness OS phone app

The standalone Android app. Everything runs inside the APK and your data is
saved on the phone, so there's no server, no account and no internet needed.
It replaces the phase 1 app that only opened the Render site.

## Screens

The tab bar follows openGym: **Home**, **Plan**, **Start**, **Meals** and **Stats**. Settings is behind the gear on Home.

- **Home:** today's session at 07:00 (or the next one on a rest day), the Sunday-start week, other sessions (home, recovery, cardio, padel), quests, meals eaten, water and your latest weight.
- **Plan:** your Upper / Lower / Push / Pull / Leg week. Tap a day to see its warm-up and working sets with RIR, rest, notes, form videos and backups.
- **Start:** a guided workout. Weight and reps come prefilled from last time and can be changed with big +/- buttons. One tap logs a set and starts the rest timer, which also buzzes as a notification with the screen off. Paired sets (A1/A2) alternate automatically, and a new best set shows a PR banner.
- **Meals:** the 14-day meal plan for any date. Pick option A or B, tick each meal off and see calories and macros against your targets. **Shopping** lists the next seven days' food by aisle, with ticks that reset each Sunday.
- **Stats:** weigh-ins with a trend chart against your goal band, your records per exercise, and links to History and Library.
- **Library:** your exercises, and **All with photos**: 876 exercises from free-exercise-db (public domain) with start/end photos, instructions, muscles and equipment, searchable and filterable. Plan exercises show the closest match's photos on their page and in the workout. Your exercises: with search, a filter by muscle group and a tappable body map. Each exercise shows your best set, estimated 1RM, where it sits in your plan and every time you've done it. You can add your own exercises too.
- **History:** every workout by month. Open one to change its date, edit a set's weight or reps, or delete sets or the whole workout.
- **Editable Plan:** tap Edit on a day to swap an exercise (same muscle group first), change sets, reps or rest, reorder, remove or add exercises. The original plan stays as the starter plan; "Reset" puts a day back.
- **Sessions:** log a home workout (its warm-up, exercises and cool-down as a checklist), recovery, cardio or padel (with the result).
- **Quests:** tick daily habits; weekly quests and milestones are earned from what you log, adding up to levels and badges.
- **Profile:** height, age, sex, activity and goal set the daily calorie and macro targets, worked out like the old site.
- **Phone extras:** the rest timer also counts down in the notification shade with +15s and Stop, so you can run a workout without opening the app between sets. Add the **Fitness OS today** widget to your home screen for today's session, streak and meals. Switch on **Health Connect** in Settings to bring in weigh-ins from a scale and share finished workouts.
- **Settings:** import your data, export a backup, turn reminders on (30 min before each 07:00 session and at every meal time), and switch **Modules** (Meals, Water, Weight) off to hide them. With Meals off, Library takes its place in the tab bar.

## Moving your data in

1. On the old site, open Settings > "Download my data" and save the file.
2. In the app, open Settings > "Import your data" and pick that file.

Backups made with "Export a backup" are in the same format and import the
same way, from any older version of the app. Data lives in the app's storage
plus a file mirror in its private folder; the newest copy wins when the app
starts. When an update changes the data format, the app upgrades it
automatically and keeps a **snapshot** of the old data first (Settings >
Snapshots keeps the newest 7, also taken before every import or restore). A
backup from a newer app version is refused instead of guessed at. **Uninstalling
the app deletes everything**, snapshots included, so export a backup now and
then; Home reminds you after 14 days.

## Getting the APK

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
- **Two APKs per tag (P14-02).** Each tag builds `fitness-os-<version>-yusuf.apk`
  (Yusuf's own plan) and `fitness-os-<version>-friends.apk` (the starter plan),
  signed with the same key. Send friends only the `-friends` file. CI fails if
  the friends APK carries any exercise or link from Yusuf's plan, and About and
  the bug report say which build is installed.

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
uninstall** (that deletes the data): message Yusuf.

One-time GitHub settings (Yusuf, as repo owner):

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
lists Fitness OS; its size should not grow when you add photos.

## Developing

```bash
cd mobile
npm ci
npm run dev        # exports content/ to src/content.json, then starts Vite
npm test           # node --test on src/lib/*.test.js
npm run photos     # downloads and converts the exercise photos (once, ~2 min, ~50 MB)
npm run build      # dist/
../scripts/build-apk.sh   # needs JDK 21 + Android SDK
```

- Plan content comes from `content/` through `scripts/export_content.py`. Never edit `src/content.json` by hand; it's generated and gitignored.
- Decision logic lives in `src/lib/` as pure functions, each with a `*.test.js` beside it. `schedule.test.js` mirrors `tests/test_gym_program.py`, so change both together.
- Exercise photos land in `public/exercise-db/` (gitignored). `npm run build:mobile` fetches them; install Pillow (`pip install pillow`) to get WebP at half the size.
- The app's own Android plugins live in `android/app/src/main/java/com/usefgamal/fitnessos/` (`timer/`, `widget/`, `health/`) and are registered in `MainActivity`. `src/store/native.js` is the JS side; in a browser they're no-ops.
- `src/store/useData.js` is the one Zustand store. `src/store/mirror.js` keeps the file copy and `src/store/notify.js` handles local notifications.
- After changing `capacitor.config.json` or a Capacitor plugin, run `npx cap sync android` and commit the result.
